import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { doctorVerificationService } from "../services/doctor-verification.service.js";

const getAdminUserId = (req: Request) => {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    return userId;
};

const getDoctor = async (req: Request, res: Response) => {
    const doctor = await doctorVerificationService.getDoctor(
        getAdminUserId(req),
        req.params.id!,
    );
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Doctor details retrieved successfully",
        data: doctor,
    });
};

const listPendingApprovals = async (req: Request, res: Response) => {
    const result = await doctorVerificationService.listPendingApprovals(
        getAdminUserId(req),
        Number(req.query.page),
        Number(req.query.limit),
    );
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Pending doctor approvals retrieved successfully",
        data: result.requests,
        pagination: result.pagination,
    });
};

const approveDoctor = async (req: Request, res: Response) => {
    const doctor = await doctorVerificationService.approveDoctor(
        getAdminUserId(req),
        req.params.id!,
    );
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Doctor approved successfully",
        data: doctor,
    });
};

const rejectDoctor = async (req: Request, res: Response) => {
    const doctor = await doctorVerificationService.rejectDoctor(
        getAdminUserId(req),
        req.params.id!,
        req.body.reason,
    );
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Doctor verification rejected successfully",
        data: doctor,
    });
};

export const doctorVerificationController = {
    getDoctor,
    listPendingApprovals,
    approveDoctor,
    rejectDoctor,
};
