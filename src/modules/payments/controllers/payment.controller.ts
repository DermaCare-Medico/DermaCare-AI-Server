import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { paymentService } from "../services/payment.service.js";

const getUserId = (req: Request) => {
    const userId = req.auth?.userId;
    if (!userId) {
        throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }
    return userId;
};

const payForAppointmentController = async (req: Request, res: Response) => {
    const payment = await paymentService.payForAppointment(
        getUserId(req),
        req.params.id!,
    );

    return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        statusCode: HTTP_STATUS.CREATED,
        message: "Appointment payment completed successfully",
        data: payment,
    });
};

const getAppointmentPaymentController = async (req: Request, res: Response) => {
    const result = await paymentService.getAppointmentPayment(
        getUserId(req),
        req.params.id!,
    );

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: result.payment
            ? "Appointment payment retrieved successfully"
            : "Appointment has not been paid",
        data: result,
    });
};

export const paymentController = {
    payForAppointmentController,
    getAppointmentPaymentController,
};
