import { z } from "zod";

import { validateRequest } from "../../middlewares/validateRequest.js";
import { uuidSchema } from "../../shared/validators/common.validator.js";

const appointmentPaymentParamsSchema = z.object({
    id: uuidSchema,
}).strict();

const appointmentPaymentBodySchema = z.preprocess(
    (value) => value ?? {},
    z.object({}).strict(),
);

export const validateAppointmentPayment = validateRequest({
    params: appointmentPaymentParamsSchema,
    body: appointmentPaymentBodySchema,
});

export const validateAppointmentPaymentId = validateRequest({
    params: appointmentPaymentParamsSchema,
});
