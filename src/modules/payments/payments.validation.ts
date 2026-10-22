import { z } from "zod";

import { validateRequest } from "../../middlewares/validateRequest.middleware.js";
import { uuidSchema } from "../../shared/validators/common.validator.js";

const appointmentPaymentParamsSchema = z.object({
    id: uuidSchema,
}).strict();

const appointmentPaymentBodySchema = z.preprocess(
    (value) => value ?? {},
    z.object({}).strict(),
);

const orderPaymentParamsSchema = z.object({
    id: uuidSchema,
}).strict();

const orderPaymentBodySchema = z.object({
    amount: z.coerce.number().positive().max(99999999.99),
    currency: z.literal("BDT"),
}).strict();

export type OrderPaymentInput = z.infer<typeof orderPaymentBodySchema>;

export const validateAppointmentPayment = validateRequest({
    params: appointmentPaymentParamsSchema,
    body: appointmentPaymentBodySchema,
});

export const validateAppointmentPaymentId = validateRequest({
    params: appointmentPaymentParamsSchema,
});

export const validateOrderPayment = validateRequest({
    params: orderPaymentParamsSchema,
    body: orderPaymentBodySchema,
});

export const validateOrderPaymentId = validateRequest({
    params: orderPaymentParamsSchema,
});
