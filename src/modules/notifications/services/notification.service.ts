import { AccountStatus, Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { NotificationListQuery } from "../notifications.validation.js";

const requireActiveUser = async (userId: string) => {
    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            status: AccountStatus.ACTIVE,
            deletedAt: null,
        },
        select: { id: true },
    });

    if (!user) throw new AppError("Only active users may access notifications", 403);
};

const listNotifications = async (userId: string, query: NotificationListQuery) => {
    await requireActiveUser(userId);

    const where: Prisma.NotificationWhereInput = {
        userId,
        ...(query.isRead !== undefined && { isRead: query.isRead }),
    };
    const skip = (query.page - 1) * query.limit;

    const [notifications, total] = await prisma.$transaction([
        prisma.notification.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: query.limit,
        }),
        prisma.notification.count({ where }),
    ]);

    return {
        notifications,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
};

const getUnreadCount = async (userId: string) => {
    await requireActiveUser(userId);

    return prisma.notification.count({
        where: { userId, isRead: false },
    });
};

const markAsRead = async (userId: string, notificationId: string) => {
    await requireActiveUser(userId);

    return prisma.$transaction(async (tx) => {
        const result = await tx.notification.updateMany({
            where: { id: notificationId, userId },
            data: { isRead: true },
        });

        if (result.count === 0) throw new AppError("Notification not found", 404);

        const notification = await tx.notification.findFirst({
            where: { id: notificationId, userId },
        });

        if (!notification) throw new AppError("Notification not found", 404);
        return notification;
    });
};

export const notificationService = { listNotifications, getUnreadCount, markAsRead };
