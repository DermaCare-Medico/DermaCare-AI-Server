import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import type { AdminUserListQuery } from "../admin.validation.js";
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

export const userManagementService = { listUsers };
