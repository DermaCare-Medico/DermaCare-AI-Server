import { z } from "zod";

import { validateRequest } from "../../middlewares/validateRequest.js";
import { uuidSchema } from "../../shared/validators/common.validator.js";

const prescriptionIdParamsSchema = z.object({
    id: uuidSchema,
}).strict();

export const validatePrescriptionId = validateRequest({
    params: prescriptionIdParamsSchema,
});
