import type { Request, Response } from "express";

import { env } from "../../../config/env.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { paymentService } from "../services/payment.service.js";

const ensureDemoPaymentsEnabled = () => {
    if (env.NODE_ENV === "production" || !env.ALLOW_DEMO_PAYMENTS) {
        throw new AppError(
            "Demo payments are disabled in this environment. Use Stripe checkout.",
            HTTP_STATUS.FORBIDDEN,
        );
    }
};

const getUserId = (req: Request) => {
    const userId = req.auth?.userId;
    if (!userId) {
        throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }
    return userId;
};

const payForAppointmentController = async (req: Request, res: Response) => {
    ensureDemoPaymentsEnabled();
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

const payForOrderController = async (req: Request, res: Response) => {
    ensureDemoPaymentsEnabled();
    const payment = await paymentService.payForOrder(
        getUserId(req),
        req.params.id!,
        req.body,
    );
    return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        statusCode: HTTP_STATUS.CREATED,
        message: "Order payment completed successfully",
        data: payment,
    });
};

const getOrderPaymentController = async (req: Request, res: Response) => {
    const result = await paymentService.getOrderPayment(getUserId(req), req.params.id!);
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: result.payment
            ? "Order payment retrieved successfully"
            : "Order has not been paid",
        data: result,
    });
};

export const paymentController = {
    payForAppointmentController,
    getAppointmentPaymentController,
    payForOrderController,
    getOrderPaymentController,
};
