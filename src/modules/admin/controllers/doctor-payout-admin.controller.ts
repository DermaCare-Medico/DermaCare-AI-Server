import type { Request, Response } from "express";

import { PayoutStatus } from "../../../generated/prisma/enums.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { doctorPayoutAdminService } from "../services/doctor-payout-admin.service.js";

const getUserId = (req: Request) => {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    return userId;
};

const listPayouts = async (req: Request, res: Response) => {
    const result = await doctorPayoutAdminService.listPayouts(getUserId(req), {
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        status: req.query.status as PayoutStatus | undefined,
    });

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Doctor payouts retrieved successfully",
        data: result.payouts,
        pagination: result.pagination,
    });
};

const sendPayout = async (req: Request, res: Response) => {
    const payout = await doctorPayoutAdminService.sendPayout(getUserId(req), req.params.id!);
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Doctor payout sent successfully",
        data: payout,
    });
};

export const doctorPayoutAdminController = { listPayouts, sendPayout };
