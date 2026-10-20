import type { Request, Response } from "express";

import {
    AccountStatus,
    DoctorApprovalStatus,
    Role,
} from "../../../generated/prisma/enums.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { userManagementService } from "../services/user-management.service.js";

const listUsers = async (req: Request, res: Response) => {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);

    const result = await userManagementService.listUsers(userId, {
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        search: req.query.search as string | undefined,
        role: req.query.role as Role | undefined,
        status: req.query.status as AccountStatus | undefined,
    });

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Users retrieved successfully",
        data: result.users,
        pagination: result.pagination,
    });
};

const getUser = async (req: Request, res: Response) => {
    const adminUserId = req.auth?.userId;
    if (!adminUserId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    const user = await userManagementService.getUser(adminUserId, req.params.id!);
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "User retrieved successfully",
        data: user,
    });
};

const updateUserStatus = async (req: Request, res: Response) => {
    const adminUserId = req.auth?.userId;
    if (!adminUserId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    const user = await userManagementService.updateUserStatus(
        adminUserId,
        req.params.id!,
        req.body,
    );
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "User status updated successfully",
        data: user,
    });
};

const listDoctors = async (req: Request, res: Response) => {
    const adminUserId = req.auth?.userId;
    if (!adminUserId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    const result = await userManagementService.listDoctors(adminUserId, {
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        search: req.query.search as string | undefined,
        specialization: req.query.specialization as string | undefined,
        status: req.query.status as DoctorApprovalStatus | undefined,
    });
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Doctors retrieved successfully",
        data: result.doctors,
        pagination: result.pagination,
    });
};

export const userManagementController = {
    listUsers,
    getUser,
    updateUserStatus,
    listDoctors,
};
