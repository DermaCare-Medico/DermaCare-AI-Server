import {
    AccountStatus,
    DoctorApprovalStatus,
    PayoutStatus,
    Prisma,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { AdminPayoutListQuery } from "../admin.validation.js";
import { requireActiveAdmin } from "./admin.service.js";

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

const sendPayout = async (adminUserId: string, payoutId: string) => {
    await requireActiveAdmin(adminUserId);

    return prisma.$transaction(async (tx) => {
        const payout = await tx.doctorPayout.findUnique({
            where: { id: payoutId },
            select: {
                status: true,
                netAmount: true,
                totalConsultations: true,
                doctor: {
                    select: {
                        approvalStatus: true,
                        user: { select: { status: true, deletedAt: true } },
                    },
                },
            },
        });

        if (!payout) throw new AppError("Doctor payout not found", 404);
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

        const paidAt = new Date();
        const updated = await tx.doctorPayout.updateMany({
            where: { id: payoutId, status: PayoutStatus.PENDING },
            data: {
                status: PayoutStatus.PAID,
                paidAt,
                transactionReference: `DEMO-${payoutId}-${paidAt.getTime()}`,
            },
        });

        if (updated.count !== 1) throw new AppError("Payout has already been processed", 409);

        return tx.doctorPayout.findUniqueOrThrow({
            where: { id: payoutId },
            select: payoutSelect,
        });
    });
};

export const doctorPayoutAdminService = { listPayouts, sendPayout };
