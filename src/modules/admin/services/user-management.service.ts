import {
    AccountStatus,
    Prisma,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type {
    AdminDoctorListQuery,
    AdminUserListQuery,
    AdminUserStatusInput,
} from "../admin.validation.js";
import { requireActiveAdmin } from "./admin.service.js";

const listUsers = async (adminUserId: string, query: AdminUserListQuery) => {
    await requireActiveAdmin(adminUserId);

    const where: Prisma.UserWhereInput = {
        deletedAt: null,
        ...(query.role && { role: query.role }),
        ...(query.status && { status: query.status }),
        ...(query.search && {
            OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
                { phone: { contains: query.search, mode: "insensitive" } },
            ],
        }),
    };

    const [users, total] = await prisma.$transaction([
        prisma.user.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                status: true,
                emailVerified: true,
                createdAt: true,
                doctorProfile: { select: { approvalStatus: true } },
            },
        }),
        prisma.user.count({ where }),
    ]);

    return {
        users,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
};

const userDetailsSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    status: true,
    emailVerified: true,
    suspendedAt: true,
    createdAt: true,
    updatedAt: true,
    patientProfile: { select: { id: true, createdAt: true } },
    doctorProfile: {
        select: {
            id: true,
            approvalStatus: true,
            qualifications: true,
            experienceYears: true,
            consultationFee: true,
            rating: true,
            ratingCount: true,
            specialization: { select: { id: true, name: true } },
        },
    },
    adminProfile: { select: { id: true, createdAt: true } },
} satisfies Prisma.UserSelect;

const getUser = async (adminUserId: string, userId: string) => {
    await requireActiveAdmin(adminUserId);
    const user = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: userDetailsSelect,
    });
    if (!user) throw new AppError("User not found", 404);
    return user;
};

const updateUserStatus = async (
    adminUserId: string,
    userId: string,
    input: AdminUserStatusInput,
) => {
    await requireActiveAdmin(adminUserId);
    if (adminUserId === userId && input.status === AccountStatus.SUSPENDED) {
        throw new AppError("Administrators cannot suspend their own account", 400);
    }

    return prisma.$transaction(async (tx) => {
        const user = await tx.user.findFirst({
            where: { id: userId, deletedAt: null },
            select: { status: true },
        });
        if (!user) throw new AppError("User not found", 404);

        const allowed =
            (user.status === AccountStatus.ACTIVE && input.status === AccountStatus.SUSPENDED)
            || (user.status === AccountStatus.SUSPENDED && input.status === AccountStatus.ACTIVE)
            || (user.status === AccountStatus.PENDING && input.status === AccountStatus.ACTIVE);
        if (!allowed) {
            throw new AppError(`User cannot transition from ${user.status} to ${input.status}`, 409);
        }

        const updated = await tx.user.updateMany({
            where: { id: userId, status: user.status, deletedAt: null },
            data: {
                status: input.status,
                suspendedAt: input.status === AccountStatus.SUSPENDED ? new Date() : null,
            },
        });
        if (updated.count !== 1) throw new AppError("User status changed; please retry", 409);

        if (input.status === AccountStatus.SUSPENDED) {
            await tx.refreshToken.deleteMany({ where: { userId } });
        }

        await tx.auditLog.create({
            data: {
                actorUserId: adminUserId,
                action: "ADMIN_USER_STATUS_UPDATED",
                entityType: "User",
                entityId: userId,
                before: { status: user.status },
                after: { status: input.status },
            },
        });

        return tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: userDetailsSelect,
        });
    });
};

const listDoctors = async (adminUserId: string, query: AdminDoctorListQuery) => {
    await requireActiveAdmin(adminUserId);
    const specializationIsId = query.specialization
        ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query.specialization)
        : false;
    const where: Prisma.DoctorProfileWhereInput = {
        ...(query.status && { approvalStatus: query.status }),
        ...(query.search && {
            OR: [
                { user: { name: { contains: query.search, mode: "insensitive" } } },
                { user: { email: { contains: query.search, mode: "insensitive" } } },
            ],
        }),
        ...(query.specialization && {
            specialization: specializationIsId
                ? { id: query.specialization }
                : { name: { contains: query.specialization, mode: "insensitive" } },
        }),
    };

    const [doctors, total] = await prisma.$transaction([
        prisma.doctorProfile.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
            select: {
                id: true,
                qualifications: true,
                experienceYears: true,
                consultationFee: true,
                approvalStatus: true,
                rating: true,
                ratingCount: true,
                createdAt: true,
                user: {
                    select: { id: true, name: true, email: true, status: true },
                },
                specialization: { select: { id: true, name: true } },
            },
        }),
        prisma.doctorProfile.count({ where }),
    ]);

    return {
        doctors,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
};

export const userManagementService = {
    listUsers,
    getUser,
    updateUserStatus,
    listDoctors,
};
