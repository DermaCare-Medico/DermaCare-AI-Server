import { Router } from "express";

import { asyncHandler } from "../../middlewares/asyncHandler.middleware.js";
import { paymentController } from "./controllers/payment.controller.js";
import { paymentVerificationController } from "./controllers/payment-verification.controller.js";
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
    "/appointments/:id/payments/checkout",
    validateAppointmentPayment,
    asyncHandler(paymentVerificationController.createAppointmentCheckout),
);

// Pharmacy Order Payments
paymentRouter.post(
    "/orders/:id/payments/simulate",
    validateOrderPayment,
    asyncHandler(paymentController.payForOrderController),
);
paymentRouter.get(
    "/orders/:id/payments",
    validateOrderPaymentId,
    asyncHandler(paymentController.getOrderPaymentController),
);
paymentRouter.post(
    "/orders/:id/payments/checkout",
    validateOrderPaymentId,
    asyncHandler(paymentVerificationController.createOrderCheckout),
);

export default paymentRouter;
