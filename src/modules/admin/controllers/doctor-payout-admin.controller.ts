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

const getMonthlyEarningsSummary = async (req: Request, res: Response) => {
    const result = await doctorPayoutAdminService.getMonthlyEarningsSummary(getUserId(req), {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        year: req.query.year ? Number(req.query.year) : undefined,
        month: req.query.month ? Number(req.query.month) : undefined,
        doctorId: req.query.doctorId as string | undefined,
    });

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Doctor monthly earnings summary retrieved successfully",
        data: result.summaries,
        pagination: result.pagination,
    });
};

const getDoctorPayable = async (req: Request, res: Response) => {
    const result = await doctorPayoutAdminService.getDoctorPayable(
        getUserId(req),
        req.params.doctorId!,
        {
            year: req.query.year ? Number(req.query.year) : undefined,
            month: req.query.month ? Number(req.query.month) : undefined,
        },
    );

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Doctor payable details retrieved successfully",
        data: result,
    });
};

const generatePayout = async (req: Request, res: Response) => {
    const result = await doctorPayoutAdminService.generateMonthlyPayout(
        getUserId(req),
        req.params.doctorId!,
        {
            year: Number(req.body.year),
            month: Number(req.body.month),
            notes: req.body.notes,
        },
    );

    const status = result.isIdempotent ? HTTP_STATUS.OK : HTTP_STATUS.CREATED;
    return res.status(status).json({
        success: true,
        statusCode: status,
        message: result.message,
        data: result.payout,
    });
};

export const doctorPayoutAdminController = {
    listPayouts,
    sendPayout,
    getMonthlyEarningsSummary,
    getDoctorPayable,
    generatePayout,
};
