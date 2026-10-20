import { z } from "zod";

import { validateRequest } from "../../middlewares/validateRequest.js";
import { uuidSchema } from "../../shared/validators/common.validator.js";

export type CreateOrderInput = {
    deliveryAddress: string;
    prescriptionId?: string;
    items: Array<{ medicineId: string; quantity: number }>;
};

const createOrderSchema = z.object({
    deliveryAddress: z.string().trim().min(10).max(1000),
    prescriptionId: uuidSchema.optional(),
    items: z.array(z.object({
        medicineId: uuidSchema,
        quantity: z.coerce.number().int().min(1).max(100),
    }).strict()).min(1).max(50),
}).strict().superRefine((value, context) => {
    const medicineIds = value.items.map((item) => item.medicineId);
    if (new Set(medicineIds).size !== medicineIds.length) {
        context.addIssue({
            code: "custom",
            path: ["items"],
            message: "Each medicine may appear only once",
        });
    }
});

export const validateCreateOrder = validateRequest({ body: createOrderSchema });
