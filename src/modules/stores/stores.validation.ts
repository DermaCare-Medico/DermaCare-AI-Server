import { z } from "zod";

import { validateRequest } from "../../middlewares/validateRequest.middleware.js";
import { uuidSchema } from "../../shared/validators/common.validator.js";

export type PublicMedicineListQuery = {
    page: number;
    limit: number;
    search?: string;
};

const publicMedicineListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(200).optional(),
}).strict();

const medicineIdParamsSchema = z.object({ id: uuidSchema }).strict();

export const validatePublicMedicineList = validateRequest({
    query: publicMedicineListQuerySchema,
});

export const validatePublicMedicineId = validateRequest({
    params: medicineIdParamsSchema,
});
