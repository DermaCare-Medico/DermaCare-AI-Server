import {
    AccountStatus,
    DoctorApprovalStatus,
    Prisma,
    Role,
    NotificationType,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { requireActiveAdmin } from "./admin.service.js";
import { createNotification } from "../../notifications/services/notification.service.js";
import { downloadPrivateImage } from "../../../shared/services/cloudinary/cloudinary.service.js";
import { selectOwnedDoctorDocument } from "../../doctors/services/doctor-profile.service.js";

const doctorDetailsSelect = {
    id: true,
    licenseNumber: true,
    qualifications: true,
    experienceYears: true,
    consultationFee: true,
    bio: true,
    documentReferences: true,
    approvalStatus: true,
    approvedAt: true,
    rejectionReason: true,
    rating: true,
    ratingCount: true,
    createdAt: true,
    updatedAt: true,
    user: {
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            emailVerified: true,
        },
    },
    specializations: {
        select: {
            specialization: { select: { id: true, name: true, description: true } },
        },
    },
    approvedBy: { select: { id: true, name: true } },
} satisfies Prisma.DoctorProfileSelect;

export const assertPendingDoctorApproval = (
    approvalStatus: DoctorApprovalStatus,
) => {
    if (approvalStatus !== DoctorApprovalStatus.PENDING) {
        throw new AppError("Doctor approval request has already been reviewed", 409);
    }
};

export const assertDoctorAccountEligibleForApproval = (account: {
    status: AccountStatus;
    deletedAt: Date | null;
    role?: Role;
}) => {
    if (
        account.deletedAt
        || account.status === AccountStatus.SUSPENDED
        || account.status === AccountStatus.REJECTED
    ) {
        throw new AppError("Doctor account is not eligible for approval", 400);
    }
    if (
        account.role
        && account.role !== Role.USER
        && account.role !== Role.PATIENT
        && account.role !== Role.DOCTOR
    ) {
        throw new AppError("Doctor account role is not eligible for approval", 400);
    }
};

const getDoctor = async (adminUserId: string, doctorId: string) => {
    await requireActiveAdmin(adminUserId);
    const doctor = await prisma.doctorProfile.findUnique({
        where: { id: doctorId },
        select: doctorDetailsSelect,
    });
    if (!doctor) throw new AppError("Doctor not found", 404);
    return doctor;
};

const downloadDoctorDocument = async (
    adminUserId: string,
    doctorId: string,
    documentIndex: number,
) => {
    await requireActiveAdmin(adminUserId);
    const doctor = await prisma.doctorProfile.findUnique({
        where: { id: doctorId },
        select: { userId: true, documentReferences: true },
    });
    if (!doctor) throw new AppError("Doctor not found", 404);
    return downloadPrivateImage(selectOwnedDoctorDocument(
        doctor.documentReferences,
        documentIndex,
        doctor.userId,
    ));
};

const listPendingApprovals = async (adminUserId: string, page: number, limit: number) => {
    await requireActiveAdmin(adminUserId);
    const where: Prisma.DoctorProfileWhereInput = {
        approvalStatus: DoctorApprovalStatus.PENDING,
        user: { deletedAt: null },
    };

    const [requests, total] = await prisma.$transaction([
        prisma.doctorProfile.findMany({
            where,
            orderBy: { createdAt: "asc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                licenseNumber: true,
                qualifications: true,
                experienceYears: true,
                documentReferences: true,
                createdAt: true,
                user: {
                    select: { id: true, name: true, email: true, status: true },
                },
                specializations: {
                    select: {
                        specialization: { select: { id: true, name: true } },
                    },
                },
            },
        }),
        prisma.doctorProfile.count({ where }),
    ]);

    return {
        requests,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

const approveDoctor = async (adminUserId: string, doctorId: string) => {
    await requireActiveAdmin(adminUserId);

    return prisma.$transaction(async (tx) => {
        const doctor = await tx.doctorProfile.findUnique({
            where: { id: doctorId },
            select: {
                approvalStatus: true,
                userId: true,
                user: { select: { status: true, deletedAt: true, role: true } },
            },
        });
        if (!doctor) throw new AppError("Doctor approval request not found", 404);
        assertPendingDoctorApproval(doctor.approvalStatus);
        assertDoctorAccountEligibleForApproval(doctor.user);

        const approvedAt = new Date();
        const updated = await tx.doctorProfile.updateMany({
            where: { id: doctorId, approvalStatus: DoctorApprovalStatus.PENDING },
            data: {
                approvalStatus: DoctorApprovalStatus.APPROVED,
                approvedById: adminUserId,
                approvedAt,
                rejectionReason: null,
            },
        });
        if (updated.count !== 1) {
            throw new AppError("Doctor approval request has already been reviewed", 409);
        }

        await tx.user.update({
            where: { id: doctor.userId },
            data: { role: Role.DOCTOR, status: AccountStatus.ACTIVE, suspendedAt: null },
        });
        await tx.auditLog.create({
            data: {
                actorUserId: adminUserId,
                action: "DOCTOR_APPROVED",
                entityType: "DoctorProfile",
                entityId: doctorId,
                before: { approvalStatus: DoctorApprovalStatus.PENDING },
                after: {
                    approvalStatus: DoctorApprovalStatus.APPROVED,
                    userRole: Role.DOCTOR,
                    userStatus: AccountStatus.ACTIVE,
                },
            },
        });

        await createNotification({
            userId: doctor.userId,
            title: "Doctor account approved",
            message: "Your doctor account has been approved.",
            notificationType: NotificationType.ACCOUNT,
            relatedEntityType: "DoctorProfile",
            relatedEntityId: doctorId,
        }, tx);

        const approved = await tx.doctorProfile.findUniqueOrThrow({
            where: { id: doctorId },
            select: doctorDetailsSelect,
        });
        return approved;
    });
};

const rejectDoctor = async (adminUserId: string, doctorId: string, reason: string) => {
    await requireActiveAdmin(adminUserId);

    return prisma.$transaction(async (tx) => {
        const doctor = await tx.doctorProfile.findUnique({
            where: { id: doctorId },
            select: { approvalStatus: true, userId: true },
        });
        if (!doctor) throw new AppError("Doctor approval request not found", 404);
        assertPendingDoctorApproval(doctor.approvalStatus);

        const updated = await tx.doctorProfile.updateMany({
            where: { id: doctorId, approvalStatus: DoctorApprovalStatus.PENDING },
            data: {
                approvalStatus: DoctorApprovalStatus.REJECTED,
                approvedById: adminUserId,
                approvedAt: null,
                rejectionReason: reason,
            },
        });
        if (updated.count !== 1) {
            throw new AppError("Doctor approval request has already been reviewed", 409);
        }

        await tx.auditLog.create({
            data: {
                actorUserId: adminUserId,
                action: "DOCTOR_REJECTED",
                entityType: "DoctorProfile",
                entityId: doctorId,
                before: { approvalStatus: DoctorApprovalStatus.PENDING },
                after: { approvalStatus: DoctorApprovalStatus.REJECTED },
            },
        });

        await createNotification({
            userId: doctor.userId,
            title: "Doctor account review completed",
            message: "Your doctor account application was not approved.",
            notificationType: NotificationType.ACCOUNT,
            relatedEntityType: "DoctorProfile",
            relatedEntityId: doctorId,
        }, tx);
        await tx.user.update({
            where: { id: doctor.userId },
            data: { role: Role.PATIENT, status: AccountStatus.ACTIVE },
        });
        await tx.patientProfile.upsert({
            where: { userId: doctor.userId },
            create: { userId: doctor.userId },
            update: {},
        });

        const rejected = await tx.doctorProfile.findUniqueOrThrow({
            where: { id: doctorId },
            select: doctorDetailsSelect,
        });
        return rejected;
    });
};

export const doctorVerificationService = {
    getDoctor,
    downloadDoctorDocument,
    listPendingApprovals,
    approveDoctor,
    rejectDoctor,
};
