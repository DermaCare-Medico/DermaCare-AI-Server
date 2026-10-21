import {
    AccountStatus,
    DoctorApprovalStatus,
    Role,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";

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

    const [patients, doctors, pendingDoctorApprovals, appointments, orders] =
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
        ]);

    return { patients, doctors, pendingDoctorApprovals, appointments, orders };
};

export const dashboardService = { getDashboard };
