import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { dashboardService } from "../services/dashboard.service.js";

const getDashboard = async (req: Request, res: Response) => {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);

    const dashboard = await dashboardService.getDashboard(userId);

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Admin dashboard retrieved successfully",
        data: dashboard,
    });
};

export const dashboardController = { getDashboard };
