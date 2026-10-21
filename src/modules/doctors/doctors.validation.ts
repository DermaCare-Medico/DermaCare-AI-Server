import { z } from "zod";

import { validateRequest } from "../../middlewares/validateRequest.js";
import { uuidSchema } from "../../shared/validators/common.validator.js";

const prescriptionIdParamsSchema = z.object({
    id: uuidSchema,
}).strict();

export const validatePrescriptionId = validateRequest({
    params: prescriptionIdParamsSchema,
});

const prescriptionListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type PatientPrescriptionListQuery = z.infer<typeof prescriptionListQuerySchema>;

export const validatePrescriptionList = validateRequest({
    query: prescriptionListQuerySchema,
});
