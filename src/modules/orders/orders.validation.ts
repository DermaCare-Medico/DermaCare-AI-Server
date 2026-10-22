import { z } from "zod";

import { validateRequest } from "../../middlewares/validateRequest.middleware.js";
import { uuidSchema } from "../../shared/validators/common.validator.js";
import { OrderStatus } from "../../generated/prisma/enums.js";

export type CreateOrderInput = {
    deliveryAddress: string;
    prescriptionId?: string;
    items: Array<{ medicineId: string; quantity: number }>;
};

export type PatientOrderListQuery = {
    page: number;
    limit: number;
    status?: OrderStatus;
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

const patientOrderListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(OrderStatus).optional(),
}).strict();

const orderIdParamsSchema = z.object({ id: uuidSchema }).strict();

export const validatePatientOrderList = validateRequest({
    query: patientOrderListQuerySchema,
});

export const validatePatientOrderId = validateRequest({ params: orderIdParamsSchema });
