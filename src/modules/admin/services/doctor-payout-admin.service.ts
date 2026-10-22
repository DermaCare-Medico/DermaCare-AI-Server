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
} from "../../doctors/services/doctor-earnings.rules.js";
import Stripe from "stripe";
import { env } from "../../../config/env.js";
import { buildCheckoutRedirects, doctorPayoutCheckoutIdempotencyKey, toStripeMinorUnits } from "../../payments/services/stripe-payment.rules.js";

let stripeClient: Stripe | undefined;
const stripe = () => {
    if (!env.STRIPE_SECRET_KEY) throw new AppError("Stripe Checkout is not configured", 503);
    stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY);
    return stripeClient;
};

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
        const existing = await stripe().checkout.sessions.retrieve(payout.transactionReference);
        if (existing.status === "open" && existing.url) {
            return { checkoutUrl: existing.url, sessionId: existing.id, payoutId, status: payout.status };
        }
        if (existing.status === "expired") {
            await prisma.doctorPayout.updateMany({
                where: { id: payoutId, status: PayoutStatus.PROCESSING, transactionReference: existing.id },
                data: { status: PayoutStatus.PENDING },
            });
            payout = { ...payout, status: PayoutStatus.PENDING };
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
        metadata: { context: "doctorPayout", payoutId, doctorId: payout.doctorId, adminUserId },
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
        approvalStatus: DoctorApprovalStatus.APPROVED,
        user: { status: AccountStatus.ACTIVE, deletedAt: null },
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
                    ...(dateRange && {
                        OR: [
                            { slot: { startTime: { gte: dateRange.periodStart, lte: dateRange.periodEnd } } },
                            { createdAt: { gte: dateRange.periodStart, lte: dateRange.periodEnd } },
                        ],
                    }),
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
                        select: { id: true, payoutId: true },
                    },
                },
            });

            const eligible = appointments.filter((apt) => getEligiblePayment(apt) !== null);

            let gross = new Prisma.Decimal(0);
            let platformFee = new Prisma.Decimal(0);
            let net = new Prisma.Decimal(0);
            let unpaidBalance = new Prisma.Decimal(0);

            for (const apt of eligible) {
                const payment = getEligiblePayment(apt)!;
                const calc = calculateConsultationEarnings(payment.amount);
                gross = gross.add(calc.consultationAmount);
                platformFee = platformFee.add(calc.platformFee);
                net = net.add(calc.doctorAmount);

                if (!apt.payoutItem) {
                    unpaidBalance = unpaidBalance.add(calc.doctorAmount);
                }
            }

            const existingPayout = dateRange
                ? await prisma.doctorPayout.findUnique({
                    where: {
                        doctorId_periodStart_periodEnd: {
                            doctorId: doc.id,
                            periodStart: dateRange.periodStartDateOnly,
                            periodEnd: dateRange.periodEndDateOnly,
                        },
                    },
                    select: {
                        id: true,
                        status: true,
                        netAmount: true,
                        paidAt: true,
                    },
                })
                : null;

            return {
                doctorId: doc.id,
                doctorName: doc.user.name,
                doctorEmail: doc.user.email,
                totalConsultations: eligible.length,
                grossAmount: gross.toFixed(2),
                platformFee: platformFee.toFixed(2),
                netAmount: net.toFixed(2),
                unpaidBalance: unpaidBalance.toFixed(2),
                payout: existingPayout
                    ? {
                        id: existingPayout.id,
                        status: existingPayout.status,
                        netAmount: existingPayout.netAmount.toFixed(2),
                        paidAt: existingPayout.paidAt,
                    }
                    : null,
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
            payoutItem: null,
            ...(dateRange && {
                OR: [
                    { slot: { startTime: { gte: dateRange.periodStart, lte: dateRange.periodEnd } } },
                    { createdAt: { gte: dateRange.periodStart, lte: dateRange.periodEnd } },
                ],
            }),
        },
        include: {
            patient: { select: { id: true, user: { select: { name: true } } } },
            slot: { select: { startTime: true, endTime: true } },
            payments: {
                where: { purpose: TransactionPurpose.APPOINTMENT, status: TransactionStatus.PAID },
                select: { purpose: true, status: true, amount: true, refundStatus: true, refundedAt: true },
            },
        },
        orderBy: { createdAt: "asc" },
    });

    const eligible = appointments.filter((apt) => getEligiblePayment(apt) !== null);

    let gross = new Prisma.Decimal(0);
    let platformFee = new Prisma.Decimal(0);
    let net = new Prisma.Decimal(0);

    const eligibleAppointments = eligible.map((apt) => {
        const payment = getEligiblePayment(apt)!;
        const calc = calculateConsultationEarnings(payment.amount);
        gross = gross.add(calc.consultationAmount);
        platformFee = platformFee.add(calc.platformFee);
        net = net.add(calc.doctorAmount);

        return {
            appointmentId: apt.id,
            date: apt.slot?.startTime ?? apt.createdAt,
            patientName: apt.patient.user.name,
            consultationAmount: calc.consultationAmount.toFixed(2),
            platformFee: calc.platformFee.toFixed(2),
            doctorAmount: calc.doctorAmount.toFixed(2),
        };
    });

    const existingPayout = dateRange
        ? await prisma.doctorPayout.findUnique({
            where: {
                doctorId_periodStart_periodEnd: {
                    doctorId,
                    periodStart: dateRange.periodStartDateOnly,
                    periodEnd: dateRange.periodEndDateOnly,
                },
            },
            select: payoutSelect,
        })
        : null;

    return {
        doctorId: doctor.id,
        doctorName: doctor.user.name,
        doctorEmail: doctor.user.email,
        consultationCount: eligible.length,
        grossAmount: gross.toFixed(2),
        platformFee: platformFee.toFixed(2),
        netAmount: net.toFixed(2),
        eligibleAppointments,
        existingPayout,
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
            OR: [
                { slot: { startTime: { gte: periodStart, lte: periodEnd } } },
                { createdAt: { gte: periodStart, lte: periodEnd } },
            ],
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

    return prisma.$transaction(async (tx) => {
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

        let totalGross = new Prisma.Decimal(0);
        let totalFee = new Prisma.Decimal(0);
        let totalNet = new Prisma.Decimal(0);

        const itemsData = eligible.map((apt) => {
            const payment = getEligiblePayment(apt)!;
            const calc = calculateConsultationEarnings(payment.amount);
            totalGross = totalGross.add(calc.consultationAmount);
            totalFee = totalFee.add(calc.platformFee);
            totalNet = totalNet.add(calc.doctorAmount);

            return {
                appointmentId: apt.id,
                consultationAmount: calc.consultationAmount,
                platformFee: calc.platformFee,
                doctorAmount: calc.doctorAmount,
            };
        });

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
    });
};

export const doctorPayoutAdminService = {
    listPayouts,
    getPayout,
    sendPayout,
    getMonthlyEarningsSummary,
    getDoctorPayable,
    generateMonthlyPayout,
};
