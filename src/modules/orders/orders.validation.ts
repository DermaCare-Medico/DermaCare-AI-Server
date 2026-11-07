import { z } from "zod";

import { validateRequest } from "../../middlewares/validateRequest.middleware.js";
import { uuidSchema } from "../../shared/validators/common.validator.js";
import { OrderStatus } from "../../generated/prisma/enums.js";

const shippingAddressSchema = z.object({
    street: z.string().trim().min(2).max(255),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().min(2).max(20),
    country: z.string().trim().min(2).max(100),
}).strict();

export type CreateOrderInput = {
    deliveryAddress?: string;
    shippingAddress?: z.infer<typeof shippingAddressSchema>;
    deliveryInstructions?: string;
    prescriptionId?: string;
    items?: Array<{ medicineId: string; quantity: number }>;
    fromCart?: boolean;
};

export type PatientOrderListQuery = {
    id?: string;
    page: number;
    limit: number;
    status?: OrderStatus;
};

const createOrderSchema = z.object({
    deliveryAddress: z.string().trim().min(10).max(1000).optional(),
    shippingAddress: shippingAddressSchema.optional(),
    deliveryInstructions: z.string().trim().max(500).optional(),
    prescriptionId: uuidSchema.optional(),
    items: z.array(z.object({
        medicineId: uuidSchema,
        quantity: z.coerce.number().int().min(1).max(100),
    }).strict()).min(1).max(50).optional(),
    fromCart: z.boolean().optional(),
}).strict().superRefine((value, context) => {
    if (!value.deliveryAddress && !value.shippingAddress) {
        context.addIssue({
            code: "custom",
            path: ["deliveryAddress"],
            message: "Either deliveryAddress or shippingAddress is required",
        });
    }

    if (!value.fromCart && (!value.items || value.items.length === 0)) {
        context.addIssue({
            code: "custom",
            path: ["items"],
            message: "Items are required when not checking out from cart",
        });
    }

    if (value.items && value.items.length > 0) {
        const medicineIds = value.items.map((item) => item.medicineId);
        if (new Set(medicineIds).size !== medicineIds.length) {
            context.addIssue({
                code: "custom",
                path: ["items"],
                message: "Each medicine may appear only once",
            });
        }
    }
});

export const validateCreateOrder = validateRequest({ body: createOrderSchema });

const patientOrderListQuerySchema = z.object({
    id: uuidSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(OrderStatus).optional(),
}).strict();

const orderIdParamsSchema = z.object({ id: uuidSchema }).strict();

export const validatePatientOrderList = validateRequest({
    query: patientOrderListQuerySchema,
});

export const validatePatientOrderId = validateRequest({ params: orderIdParamsSchema });
