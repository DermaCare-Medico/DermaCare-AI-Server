import { AccountStatus, Prisma, Role } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { AdminAuditLogListQuery } from "../admin.validation.js";

export const requireActiveAdmin = async (userId: string) => {
    const admin = await prisma.user.findFirst({
        where: {
            id: userId,
            role: Role.ADMIN,
            status: AccountStatus.ACTIVE,
            deletedAt: null,
        },
        select: { id: true },
    });

    if (!admin) throw new AppError("Only active administrators may access this resource", 403);
};

export const listAuditLogs = async (
    adminUserId: string,
    query: AdminAuditLogListQuery,
) => {
    await requireActiveAdmin(adminUserId);
    const where: Prisma.AuditLogWhereInput = {
        ...(query.actorUserId && { actorUserId: query.actorUserId }),
        ...(query.action && { action: { contains: query.action, mode: "insensitive" } }),
        ...(query.entityType && {
            entityType: { equals: query.entityType, mode: "insensitive" },
        }),
        ...(query.entityId && { entityId: query.entityId }),
        ...((query.dateFrom || query.dateTo) && {
            createdAt: {
                ...(query.dateFrom && { gte: query.dateFrom }),
                ...(query.dateTo && { lte: query.dateTo }),
            },
        }),
    };

    const [logs, total] = await prisma.$transaction([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
            select: {
                id: true,
                action: true,
                entityType: true,
                entityId: true,
                before: true,
                after: true,
                metadata: true,
                createdAt: true,
                actor: { select: { id: true, name: true, role: true } },
            },
        }),
        prisma.auditLog.count({ where }),
    ]);

    return {
        logs,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
};
