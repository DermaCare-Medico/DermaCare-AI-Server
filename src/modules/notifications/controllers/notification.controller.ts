import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { notificationService } from "../services/notification.service.js";

const listNotifications = async (req: Request, res: Response) => {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);

    const result = await notificationService.listNotifications(userId, {
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        isRead: req.query.isRead as boolean | undefined,
    });

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Notifications retrieved successfully",
        data: result.notifications,
        pagination: result.pagination,
    });
};

const getUnreadCount = async (req: Request, res: Response) => {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);

    const unreadCount = await notificationService.getUnreadCount(userId);

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Unread notification count retrieved successfully",
        data: { unreadCount },
    });
};

const markAsRead = async (req: Request, res: Response) => {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);

    const notification = await notificationService.markAsRead(userId, req.params.id!);

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Notification marked as read successfully",
        data: notification,
    });
};

const markAllAsRead = async (req: Request, res: Response) => {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);

    const updatedCount = await notificationService.markAllAsRead(userId);

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Notifications marked as read successfully",
        data: { updatedCount },
    });
};

export const notificationController = {
    listNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
};
