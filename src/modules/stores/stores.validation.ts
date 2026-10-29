import { z } from "zod";

import { validateRequest } from "../../middlewares/validateRequest.middleware.js";
import { uuidSchema } from "../../shared/validators/common.validator.js";

export type PublicMedicineListQuery = {
    page: number;
    limit: number;
    search?: string;
    requiresPrescription?: boolean;
};

const publicMedicineListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(200).optional(),
    requiresPrescription: z.preprocess((val) => {
        if (typeof val === "string") {
            if (val.toLowerCase() === "true") return true;
            if (val.toLowerCase() === "false") return false;
        }
        return val;
    }, z.boolean().optional()),
}).strict();

const medicineIdParamsSchema = z.object({ id: uuidSchema }).strict();

export const validatePublicMedicineList = validateRequest({
    query: publicMedicineListQuerySchema,
});

export const validatePublicMedicineId = validateRequest({
    params: medicineIdParamsSchema,
});

export const addToCartSchema = z.object({
    medicineId: uuidSchema,
    quantity: z.coerce.number().int().min(1).max(100).default(1),
    prescriptionId: uuidSchema.optional(),
}).strict();

export const updateCartItemSchema = z.object({
    quantity: z.coerce.number().int().min(1).max(100),
}).strict();

export const cartItemIdParamsSchema = z.object({
    id: uuidSchema,
}).strict();

export const validateAddToCart = validateRequest({
    body: addToCartSchema,
});

export const validateUpdateCartItem = validateRequest({
    body: updateCartItemSchema,
    params: cartItemIdParamsSchema,
});

export const validateCartItemId = validateRequest({
    params: cartItemIdParamsSchema,
});
