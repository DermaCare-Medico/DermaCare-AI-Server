import { Router } from "express";

import { asyncHandler } from "../../middlewares/asyncHandler.middleware.js";
import { paymentController } from "./controllers/payment.controller.js";
import {
    validateAppointmentPayment,
    validateAppointmentPaymentId,
    validateOrderPayment,
    validateOrderPaymentId,
} from "./payments.validation.js";

const paymentRouter = Router();

// Mount only after the application's JWT middleware has populated req.auth.
paymentRouter.post(
    "/appointments/:id/payments",
    validateAppointmentPayment,
    asyncHandler(paymentController.payForAppointmentController),
);
paymentRouter.get(
    "/appointments/:id/payments",
    validateAppointmentPaymentId,
    asyncHandler(paymentController.getAppointmentPaymentController),
);
paymentRouter.post(
    "/orders/:id/payments",
    validateOrderPayment,
    asyncHandler(paymentController.payForOrderController),
);
paymentRouter.get(
    "/orders/:id/payments",
    validateOrderPaymentId,
    asyncHandler(paymentController.getOrderPaymentController),
);

export default paymentRouter;
