import {
    AccountStatus,
    AppointmentStatus,
    DoctorApprovalStatus,
    PayoutStatus,
    Prisma,
    TransactionPurpose,
    TransactionStatus,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { AdminPayoutListQuery } from "../admin.validation.js";
import { requireActiveAdmin } from "./admin.service.js";
import {
    calculateConsultationEarnings,
    getEligiblePayment,
    getMonthDateRange,
    slotStartInEarningsRange,
} from "../../doctors/services/doctor-earnings.rules.js";
import { aggregateDoctorEarnings, findLedgerMismatches, formatDoctorEarningsAggregate } from "../../doctors/services/doctor-earnings-aggregation.service.js";
import Stripe from "stripe";
import { env } from "../../../config/env.js";
import { buildCheckoutRedirects, buildDoctorPayoutMetadata, doctorPayoutCheckoutIdempotencyKey, toStripeMinorUnits } from "../../payments/services/stripe-payment.rules.js";
import { reconcileDoctorPayout } from "../../payments/services/doctor-payout-reconciliation.service.js";
import { logger } from "../../../shared/logger/logger.js";

let stripeClient: Stripe | undefined;
const stripe = () => {
    if (!env.STRIPE_SECRET_KEY) throw new AppError("Stripe Checkout is not configured", 503);
    stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY);
    return stripeClient;
};

export const isStripeCheckoutSessionResourceMissing = (error: unknown): error is Stripe.errors.StripeInvalidRequestError =>
    error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing";

export const isRetryablePayoutGenerationConflict = (error: unknown) =>
    error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === "P2002" || error.code === "P2034");

const payoutSelect = {
    id: true,
    periodStart: true,
    periodEnd: true,
    totalConsultations: true,
    grossAmount: true,
    platformFee: true,
    netAmount: true,
    status: true,
    paidAt: true,
    transactionReference: true,
    stripePaymentIntentId: true,
    paidByAdminId: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
    doctor: {
        select: {
            id: true,
            user: { select: { id: true, name: true, email: true } },
        },
    },
} satisfies Prisma.DoctorPayoutSelect;

const listPayouts = async (adminUserId: string, query: AdminPayoutListQuery) => {
    await requireActiveAdmin(adminUserId);
    const where: Prisma.DoctorPayoutWhereInput = {
        ...(query.status && { status: query.status }),
    };

    const [payouts, total] = await prisma.$transaction([
        prisma.doctorPayout.findMany({
            where,
            select: payoutSelect,
            orderBy: { createdAt: "desc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        }),
        prisma.doctorPayout.count({ where }),
    ]);

    return {
        payouts,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
};

const getPayout = async (adminUserId: string, payoutId: string) => {
    await requireActiveAdmin(adminUserId);
    const payout = await prisma.doctorPayout.findUnique({ where: { id: payoutId }, select: payoutSelect });
    if (!payout) throw new AppError("Doctor payout not found", 404);
    return payout;
};

const sendPayout = async (adminUserId: string, payoutId: string) => {
    await requireActiveAdmin(adminUserId);
    let payout = await prisma.doctorPayout.findUnique({
            where: { id: payoutId },
            select: {
                id: true,
                doctorId: true,
                status: true,
                netAmount: true,
                transactionReference: true,
                totalConsultations: true,
                doctor: {
                    select: {
                        approvalStatus: true,
                        user: { select: { id: true, status: true, deletedAt: true } },
                    },
                },
            },
        });

    if (!payout) throw new AppError("Doctor payout not found", 404);
    if (payout.status === PayoutStatus.PROCESSING && payout.transactionReference) {
        let existing: Stripe.Checkout.Session;
        try {
            existing = await stripe().checkout.sessions.retrieve(payout.transactionReference);
        } catch (error) {
            if (!isStripeCheckoutSessionResourceMissing(error)) throw error;
            logger.warn({
                payoutId: payout.id,
                sessionId: payout.transactionReference,
                stripeRequestId: error.requestId,
            }, "Stored Stripe Checkout Session could not be found in the configured Stripe account");
            throw new AppError(
                "The stored Stripe Checkout Session could not be found in the currently configured Stripe account. Verify the Stripe account/API key before taking further action.",
                409,
            );
        }
        if (existing.status === "open" && existing.url) {
            return { checkoutUrl: existing.url, sessionId: existing.id, payoutId, status: payout.status };
        }
        if (existing.status === "expired") {
            await prisma.doctorPayout.updateMany({
                where: { id: payoutId, status: PayoutStatus.PROCESSING, transactionReference: existing.id },
                data: { status: PayoutStatus.PENDING },
            });
            payout = { ...payout, status: PayoutStatus.PENDING };
        } else if (existing.status === "complete") {
            const reconciled = await reconcileDoctorPayout(existing);
            if (reconciled) {
                return { checkoutUrl: existing.url, sessionId: existing.id, payoutId, status: PayoutStatus.PAID };
            }
            return { checkoutUrl: existing.url, sessionId: existing.id, payoutId, status: PayoutStatus.PROCESSING };
        } else {
            throw new AppError("Payout confirmation is being processed", 409);
        }
    }
    if (payout.status !== PayoutStatus.PENDING) {
            throw new AppError("Payout has already been processed", 409);
    }
    if (payout.netAmount.lte(0) || payout.totalConsultations < 1) {
            throw new AppError("Payout is not eligible for processing", 400);
    }
    if (
            payout.doctor.approvalStatus !== DoctorApprovalStatus.APPROVED
            || payout.doctor.user.status !== AccountStatus.ACTIVE
            || payout.doctor.user.deletedAt
    ) {
            throw new AppError("Doctor is not eligible to receive payouts", 400);
    }

    const redirects = buildCheckoutRedirects(env.CLIENT_URL, "doctorPayout", payoutId);
    const attempt = payout.transactionReference ?? "initial";
    const session = await stripe().checkout.sessions.create({
        mode: "payment",
        success_url: redirects.successUrl,
        cancel_url: redirects.cancelUrl,
        client_reference_id: payoutId,
        metadata: { context: "doctorPayout", ...buildDoctorPayoutMetadata(payoutId, payout.doctorId, adminUserId) },
        payment_intent_data: {
            metadata: buildDoctorPayoutMetadata(payoutId, payout.doctorId, adminUserId),
        },
        line_items: [{ quantity: 1, price_data: {
            currency: "bdt",
            unit_amount: toStripeMinorUnits(payout.netAmount),
            product_data: { name: "Doctor monthly demo payout" },
        } }],
    }, { idempotencyKey: doctorPayoutCheckoutIdempotencyKey(payoutId, attempt) });
    if (!session.url) throw new AppError("Stripe did not return a checkout URL", 502);

    const claimed = await prisma.doctorPayout.updateMany({
        where: { id: payoutId, status: PayoutStatus.PENDING },
        data: { status: PayoutStatus.PROCESSING, transactionReference: session.id },
    });
    if (claimed.count !== 1) {
        const current = await prisma.doctorPayout.findUnique({ where: { id: payoutId }, select: { status: true, transactionReference: true } });
        if (current?.status !== PayoutStatus.PROCESSING || current.transactionReference !== session.id) {
            throw new AppError("Payout has already been processed", 409);
        }
    }
    return { checkoutUrl: session.url, sessionId: session.id, payoutId, status: PayoutStatus.PROCESSING };
};

const getMonthlyEarningsSummary = async (
    adminUserId: string,
    query: {
        year?: number;
        month?: number;
        doctorId?: string;
        page: number;
        limit: number;
    },
) => {
    await requireActiveAdmin(adminUserId);

    const dateRange = (query.year && query.month)
        ? getMonthDateRange(query.year, query.month)
        : null;

    const doctorWhere: Prisma.DoctorProfileWhereInput = {
        ...(query.doctorId && { id: query.doctorId }),
    };

    const [doctors, total] = await prisma.$transaction([
        prisma.doctorProfile.findMany({
            where: doctorWhere,
            select: {
                id: true,
                consultationFee: true,
                user: { select: { id: true, name: true, email: true } },
            },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        }),
        prisma.doctorProfile.count({ where: doctorWhere }),
    ]);

    const summaries = await Promise.all(
        doctors.map(async (doc) => {
            const appointments = await prisma.appointment.findMany({
                where: {
                    doctorId: doc.id,
                    status: AppointmentStatus.COMPLETED,
                    ...(dateRange && slotStartInEarningsRange(dateRange)),
                },
                select: {
                    id: true,
                    status: true,
                    payments: {
                        where: {
                            purpose: TransactionPurpose.APPOINTMENT,
                            status: TransactionStatus.PAID,
                        },
                        select: {
                            purpose: true,
                            status: true,
                            amount: true,
                            refundStatus: true,
                            refundedAt: true,
                        },
                    },
                    payoutItem: {
                        select: {
                            id: true,
                            payoutId: true,
                            consultationAmount: true,
                            platformFee: true,
                            doctorAmount: true,
                            payout: { select: { status: true, paidAt: true } },
                        },
                    },
                },
            });

            const aggregate = aggregateDoctorEarnings(appointments);
            const payoutHistory = await prisma.doctorPayout.findMany({
                where: {
                    doctorId: doc.id,
                    ...(dateRange && {
                        periodStart: { lte: dateRange.periodEndDateOnly },
                        periodEnd: { gte: dateRange.periodStartDateOnly },
                    }),
                },
                select: { id: true, periodStart: true, periodEnd: true, status: true, netAmount: true, paidAt: true },
                orderBy: { createdAt: "desc" },
            });
            const formatted = formatDoctorEarningsAggregate(aggregate);

            return {
                doctorId: doc.id,
                doctorName: doc.user.name,
                doctorEmail: doc.user.email,
                ...formatted,
                payoutStatus: payoutHistory[0]?.status ?? (formatted.unallocatedAmount !== "0.00" ? PayoutStatus.PENDING : null),
                ledgerConsistency: {
                    isConsistent: findLedgerMismatches(appointments).length === 0,
                    mismatches: findLedgerMismatches(appointments),
                },
                payoutHistory: payoutHistory.map((payout) => ({
                    ...payout,
                    netAmount: payout.netAmount.toFixed(2),
                })),
            };
        }),
    );

    return {
        summaries,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit) || 1,
        },
    };
};

const getDoctorPayable = async (
    adminUserId: string,
    doctorId: string,
    query?: { year?: number; month?: number },
) => {
    await requireActiveAdmin(adminUserId);

    const doctor = await prisma.doctorProfile.findUnique({
        where: { id: doctorId },
        select: {
            id: true,
            approvalStatus: true,
            consultationFee: true,
            user: { select: { id: true, name: true, email: true, status: true, deletedAt: true } },
        },
    });

    if (!doctor) throw new AppError("Doctor not found", 404);

    const dateRange = (query?.year && query?.month)
        ? getMonthDateRange(query.year, query.month)
        : null;

    const appointments = await prisma.appointment.findMany({
        where: {
            doctorId,
            status: AppointmentStatus.COMPLETED,
            ...(dateRange && slotStartInEarningsRange(dateRange)),
        },
        include: {
            patient: { select: { id: true, user: { select: { name: true } } } },
            slot: { select: { startTime: true, endTime: true } },
            payments: {
                where: { purpose: TransactionPurpose.APPOINTMENT, status: TransactionStatus.PAID },
                select: {
                    id: true,
                    purpose: true,
                    status: true,
                    amount: true,
                    currency: true,
                    provider: true,
                    providerTransactionId: true,
                    stripePaymentIntentId: true,
                    refundStatus: true,
                    refundedAt: true,
                    paidAt: true,
                },
            },
            payoutItem: {
                select: {
                    id: true,
                    payoutId: true,
                    consultationAmount: true,
                    platformFee: true,
                    doctorAmount: true,
                    payout: { select: { status: true, paidAt: true } },
                },
            },
        },
        orderBy: { createdAt: "asc" },
    });

    const eligible = appointments.filter((apt) => getEligiblePayment(apt) !== null);

    const aggregate = aggregateDoctorEarnings(appointments);

    const eligibleAppointments = eligible.map((apt) => {
        const payment = getEligiblePayment(apt)!;
        const calc = calculateConsultationEarnings(payment.amount);

        return {
            appointmentId: apt.id,
            date: apt.slot?.startTime ?? apt.createdAt,
            patientName: apt.patient.user.name,
            consultationAmount: calc.consultationAmount.toFixed(2),
            platformFee: calc.platformFee.toFixed(2),
            doctorAmount: calc.doctorAmount.toFixed(2),
            payment: {
                id: payment.id,
                amount: payment.amount.toFixed(2),
                currency: payment.currency,
                status: payment.status,
                provider: payment.provider,
                providerTransactionId: payment.providerTransactionId,
                stripePaymentIntentId: payment.stripePaymentIntentId,
                refundStatus: payment.refundStatus,
                refundedAt: payment.refundedAt,
                paidAt: payment.paidAt,
            },
            payoutItem: apt.payoutItem
                ? {
                    id: apt.payoutItem.id,
                    payoutId: apt.payoutItem.payoutId,
                    status: apt.payoutItem.payout.status,
                    paidAt: apt.payoutItem.payout.paidAt,
                    consultationAmount: apt.payoutItem.consultationAmount.toFixed(2),
                    platformFee: apt.payoutItem.platformFee.toFixed(2),
                    doctorAmount: apt.payoutItem.doctorAmount.toFixed(2),
                }
                : null,
        };
    });

    const payoutHistory = await prisma.doctorPayout.findMany({
        where: {
            doctorId,
            ...(dateRange && {
                periodStart: { lte: dateRange.periodEndDateOnly },
                periodEnd: { gte: dateRange.periodStartDateOnly },
            }),
        },
        select: payoutSelect,
        orderBy: { createdAt: "desc" },
    });

    return {
        doctorId: doctor.id,
        doctorName: doctor.user.name,
        doctorEmail: doctor.user.email,
        consultationCount: aggregate.eligibleConsultations,
        ...formatDoctorEarningsAggregate(aggregate),
        ledgerConsistency: {
            isConsistent: findLedgerMismatches(appointments).length === 0,
            mismatches: findLedgerMismatches(appointments),
        },
        eligibleAppointments,
        existingPayout: payoutHistory[0] ?? null,
        payoutHistory,
    };
};

const generateMonthlyPayout = async (
    adminUserId: string,
    doctorId: string,
    input: { year: number; month: number; notes?: string },
) => {
    await requireActiveAdmin(adminUserId);

    const doctor = await prisma.doctorProfile.findUnique({
        where: { id: doctorId },
        select: {
            id: true,
            approvalStatus: true,
            user: { select: { id: true, status: true, deletedAt: true } },
        },
    });

    if (!doctor) throw new AppError("Doctor not found", 404);
    if (
        doctor.approvalStatus !== DoctorApprovalStatus.APPROVED
        || doctor.user.status !== AccountStatus.ACTIVE
        || doctor.user.deletedAt
    ) {
        throw new AppError("Doctor is not eligible to receive payouts", 400);
    }

    const { periodStart, periodEnd, periodStartDateOnly, periodEndDateOnly } = getMonthDateRange(
        input.year,
        input.month,
    );

    // Idempotency check: return existing payout if already generated for this doctor & period
    const existingPayout = await prisma.doctorPayout.findUnique({
        where: {
            doctorId_periodStart_periodEnd: {
                doctorId,
                periodStart: periodStartDateOnly,
                periodEnd: periodEndDateOnly,
            },
        },
        select: payoutSelect,
    });

    if (existingPayout) {
        return {
            isIdempotent: true,
            message: "Doctor payout for this period already exists",
            payout: existingPayout,
        };
    }

    const appointments = await prisma.appointment.findMany({
        where: {
            doctorId,
            status: AppointmentStatus.COMPLETED,
            payoutItem: null,
            ...slotStartInEarningsRange({ periodStart, periodEnd }),
        },
        include: {
            payments: {
                where: { purpose: TransactionPurpose.APPOINTMENT, status: TransactionStatus.PAID },
                select: { purpose: true, status: true, amount: true, refundStatus: true, refundedAt: true },
            },
        },
    });

    const eligible = appointments.filter((apt) => getEligiblePayment(apt) !== null);

    if (eligible.length === 0) {
        throw new AppError("No eligible completed paid consultations found for this period", 400);
    }

    const createPayout = () => prisma.$transaction(async (tx) => {
        // Concurrency guard
        const recheck = await tx.doctorPayout.findUnique({
            where: {
                doctorId_periodStart_periodEnd: {
                    doctorId,
                    periodStart: periodStartDateOnly,
                    periodEnd: periodEndDateOnly,
                },
            },
            select: payoutSelect,
        });

        if (recheck) {
            return {
                isIdempotent: true,
                message: "Doctor payout for this period already exists",
                payout: recheck,
            };
        }

        const itemsData = eligible.map((apt) => {
            const payment = getEligiblePayment(apt)!;
            const calc = calculateConsultationEarnings(payment.amount);

            return {
                appointmentId: apt.id,
                consultationAmount: calc.consultationAmount,
                platformFee: calc.platformFee,
                doctorAmount: calc.doctorAmount,
            };
        });
        const aggregate = aggregateDoctorEarnings(eligible);
        const totalGross = aggregate.grossAmount;
        const totalFee = aggregate.platformFee;
        const totalNet = aggregate.netAmount;

        const created = await tx.doctorPayout.create({
            data: {
                doctorId,
                periodStart: periodStartDateOnly,
                periodEnd: periodEndDateOnly,
                totalConsultations: eligible.length,
                grossAmount: totalGross,
                platformFee: totalFee,
                netAmount: totalNet,
                status: PayoutStatus.PENDING,
                notes: input.notes,
                items: {
                    create: itemsData,
                },
            },
            select: payoutSelect,
        });

        await tx.auditLog.create({
            data: {
                actorUserId: adminUserId,
                action: "DOCTOR_PAYOUT_GENERATED",
                entityType: "DoctorPayout",
                entityId: created.id,
                before: {},
                after: {
                    status: PayoutStatus.PENDING,
                    totalConsultations: eligible.length,
                    grossAmount: totalGross.toString(),
                    platformFee: totalFee.toString(),
                    netAmount: totalNet.toString(),
                    periodStart: periodStartDateOnly.toISOString(),
                    periodEnd: periodEndDateOnly.toISOString(),
                },
                metadata: { doctorId },
            },
        });

        return {
            isIdempotent: false,
            message: "Doctor payout generated successfully",
            payout: created,
        };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await createPayout();
        } catch (error) {
            if (!isRetryablePayoutGenerationConflict(error)) throw error;
            const concurrent = await prisma.doctorPayout.findUnique({
                where: { doctorId_periodStart_periodEnd: { doctorId, periodStart: periodStartDateOnly, periodEnd: periodEndDateOnly } },
                select: payoutSelect,
            });
            if (concurrent) return {
                isIdempotent: true,
                message: "Doctor payout for this period already exists",
                payout: concurrent,
            };
            if (attempt === 2) throw error;
        }
    }
    throw new AppError("Doctor payout generation could not be completed", 409);
};

export const doctorPayoutAdminService = {
    listPayouts,
    getPayout,
    sendPayout,
    getMonthlyEarningsSummary,
    getDoctorPayable,
    generateMonthlyPayout,
};
