import {
    AccountStatus,
    AppointmentStatus,
    DoctorApprovalStatus,
    PayoutStatus,
    Prisma,
    RefundStatus,
    Role,
    TransactionPurpose,
    TransactionStatus,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import {
    calculateConsultationEarnings,
    getEligiblePayment,
    getMonthDateRange,
} from "../../doctors/services/doctor-earnings.rules.js";

type FinancialAppointment = {
    status: AppointmentStatus;
    slot: { startTime: Date };
    payments: Array<{
        purpose: TransactionPurpose;
        status: TransactionStatus;
        amount: Prisma.Decimal;
        refundStatus: RefundStatus | null;
        refundedAt: Date | null;
    }>;
    payoutItem: {
        doctorAmount: Prisma.Decimal;
        payout: { status: PayoutStatus };
    } | null;
};

export const calculateDashboardFinancials = (
    appointments: FinancialAppointment[],
    paidPayoutAmounts: Prisma.Decimal[],
    successfulRefundAmounts: Prisma.Decimal[],
    now = new Date(),
) => {
    const month = getMonthDateRange(now.getUTCFullYear(), now.getUTCMonth() + 1);
    let totalConsultationRevenue = new Prisma.Decimal(0);
    let platformCommissionEarned = new Prisma.Decimal(0);
    let outstandingDoctorPayouts = new Prisma.Decimal(0);
    let monthlyConsultationRevenue = new Prisma.Decimal(0);
    let monthlyPlatformCommission = new Prisma.Decimal(0);

    for (const appointment of appointments) {
        const payment = getEligiblePayment(appointment);
        if (!payment) continue;
        const earnings = calculateConsultationEarnings(payment.amount);
        totalConsultationRevenue = totalConsultationRevenue.add(earnings.consultationAmount);
        platformCommissionEarned = platformCommissionEarned.add(earnings.platformFee);
        if (!appointment.payoutItem || appointment.payoutItem.payout.status !== PayoutStatus.PAID) {
            outstandingDoctorPayouts = outstandingDoctorPayouts.add(
                appointment.payoutItem?.doctorAmount ?? earnings.doctorAmount,
            );
        }
        if (appointment.slot.startTime >= month.periodStart && appointment.slot.startTime <= month.periodEnd) {
            monthlyConsultationRevenue = monthlyConsultationRevenue.add(earnings.consultationAmount);
            monthlyPlatformCommission = monthlyPlatformCommission.add(earnings.platformFee);
        }
    }

    const doctorPayoutsPaid = paidPayoutAmounts.reduce(
        (total, amount) => total.add(amount),
        new Prisma.Decimal(0),
    );
    const totalSuccessfulRefunds = successfulRefundAmounts.reduce(
        (total, amount) => total.add(amount),
        new Prisma.Decimal(0),
    );
    const doctorTotalPayable = doctorPayoutsPaid.add(outstandingDoctorPayouts);

    return {
        currency: "BDT",
        totalConsultationRevenue: totalConsultationRevenue.toFixed(2),
        platformCommissionEarned: platformCommissionEarned.toFixed(2),
        doctorTotalPayable: doctorTotalPayable.toFixed(2),
        doctorPayoutsPaid: doctorPayoutsPaid.toFixed(2),
        outstandingDoctorPayouts: outstandingDoctorPayouts.toFixed(2),
        totalSuccessfulRefunds: totalSuccessfulRefunds.toFixed(2),
        monthlyConsultationRevenue: monthlyConsultationRevenue.toFixed(2),
        monthlyPlatformCommission: monthlyPlatformCommission.toFixed(2),
    };
};

const getDashboard = async (userId: string) => {
    const admin = await prisma.user.findFirst({
        where: {
            id: userId,
            role: Role.ADMIN,
            status: AccountStatus.ACTIVE,
            deletedAt: null,
        },
        select: { id: true },
    });

    if (!admin) throw new AppError("Only active administrators may access the dashboard", 403);

    const [patients, doctors, pendingDoctorApprovals, appointments, orders,
        consultationAppointments, paidPayouts, successfulRefunds] =
        await prisma.$transaction([
            prisma.user.count({
                where: {
                    role: Role.PATIENT,
                    status: AccountStatus.ACTIVE,
                    deletedAt: null,
                    patientProfile: { isNot: null },
                },
            }),
            prisma.doctorProfile.count({
                where: {
                    approvalStatus: DoctorApprovalStatus.APPROVED,
                    user: {
                        status: AccountStatus.ACTIVE,
                        deletedAt: null,
                    },
                },
            }),
            prisma.doctorProfile.count({
                where: {
                    approvalStatus: DoctorApprovalStatus.PENDING,
                    user: {
                        status: { in: [AccountStatus.ACTIVE, AccountStatus.PENDING] },
                        deletedAt: null,
                    },
                },
            }),
            prisma.appointment.count(),
            prisma.order.count(),
            prisma.appointment.findMany({
                where: { status: AppointmentStatus.COMPLETED },
                select: {
                    status: true,
                    slot: { select: { startTime: true } },
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
                        orderBy: { createdAt: "asc" },
                    },
                    payoutItem: {
                        select: {
                            doctorAmount: true,
                            payout: { select: { status: true } },
                        },
                    },
                },
            }),
            prisma.doctorPayout.findMany({
                where: { status: PayoutStatus.PAID },
                select: { netAmount: true },
            }),
            prisma.paymentTransaction.findMany({
                where: {
                    purpose: TransactionPurpose.APPOINTMENT,
                    OR: [
                        { status: TransactionStatus.REFUNDED },
                        { refundStatus: RefundStatus.SUCCEEDED },
                    ],
                },
                select: { amount: true },
            }),
        ]);

    const financialOverview = calculateDashboardFinancials(
        consultationAppointments,
        paidPayouts.map(({ netAmount }) => netAmount),
        successfulRefunds.map(({ amount }) => amount),
    );

    return { patients, doctors, pendingDoctorApprovals, appointments, orders, ...financialOverview };
};

export const dashboardService = { getDashboard };
