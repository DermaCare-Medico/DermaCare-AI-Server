import { z } from "zod";

import {
    AccountStatus,
    DoctorApprovalStatus,
    OrderStatus,
    PayoutStatus,
    Role,
} from "../../generated/prisma/enums.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { uuidSchema } from "../../shared/validators/common.validator.js";

export type AdminPayoutListQuery = {
    page: number;
    limit: number;
    status?: PayoutStatus;
};

export type AdminOrderListQuery = {
    page: number;
    limit: number;
    status?: OrderStatus;
};

export type AdminUserListQuery = {
    page: number;
    limit: number;
    search?: string;
    role?: Role;
    status?: AccountStatus;
};

export type AdminOrderStatusInput = {
    status: OrderStatus;
    reason?: string;
};

export type AdminUserStatusInput = {
    status: "ACTIVE" | "SUSPENDED";
};

export type AdminDoctorListQuery = {
    page: number;
    limit: number;
    search?: string;
    specialization?: string;
    status?: DoctorApprovalStatus;
};

const paginationShape = {
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
};

const payoutListQuerySchema = z.object({
    ...paginationShape,
    status: z.enum(PayoutStatus).optional(),
}).strict();

const payoutIdParamsSchema = z.object({ id: uuidSchema }).strict();

const orderListQuerySchema = z.object({
    ...paginationShape,
    status: z.enum(OrderStatus).optional(),
}).strict();

const orderIdParamsSchema = z.object({ id: uuidSchema }).strict();

const orderStatusSchema = z.object({
    status: z.enum([
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
    ]),
    reason: z.string().trim().min(3).max(500).optional(),
}).strict().superRefine((value, context) => {
    if (value.status === OrderStatus.CANCELLED && !value.reason) {
        context.addIssue({
            code: "custom",
            path: ["reason"],
            message: "A reason is required when rejecting or cancelling an order",
        });
    }
});

const userListQuerySchema = z.object({
    ...paginationShape,
    search: z.string().trim().min(1).max(150).optional(),
    role: z.enum(Role).optional(),
    status: z.enum(AccountStatus).optional(),
}).strict();

const userIdParamsSchema = z.object({ id: uuidSchema }).strict();

const userStatusSchema = z.object({
    status: z.enum([AccountStatus.ACTIVE, AccountStatus.SUSPENDED]),
}).strict();

const doctorListQuerySchema = z.object({
    ...paginationShape,
    search: z.string().trim().min(1).max(150).optional(),
    specialization: z.string().trim().min(1).max(150).optional(),
    status: z.enum(DoctorApprovalStatus).optional(),
}).strict();

const doctorIdParamsSchema = z.object({ id: uuidSchema }).strict();

const doctorApprovalListQuerySchema = z.object({
    ...paginationShape,
}).strict();

const approveDoctorBodySchema = z.preprocess(
    (value) => value ?? {},
    z.object({}).strict(),
);

export const validateAdminPayoutList = validateRequest({ query: payoutListQuerySchema });
export const validateAdminPayoutId = validateRequest({ params: payoutIdParamsSchema });
export const validateAdminOrderList = validateRequest({ query: orderListQuerySchema });
export const validateAdminOrderId = validateRequest({ params: orderIdParamsSchema });
export const validateAdminOrderStatus = validateRequest({
    params: orderIdParamsSchema,
    body: orderStatusSchema,
});
export const validateAdminUserList = validateRequest({ query: userListQuerySchema });
export const validateAdminUserId = validateRequest({ params: userIdParamsSchema });
export const validateAdminUserStatus = validateRequest({
    params: userIdParamsSchema,
    body: userStatusSchema,
});
export const validateAdminDoctorList = validateRequest({ query: doctorListQuerySchema });
export const validateAdminDoctorId = validateRequest({ params: doctorIdParamsSchema });
export const validateAdminDoctorApprovalList = validateRequest({
    query: doctorApprovalListQuerySchema,
});
export const validateAdminDoctorApproval = validateRequest({
    params: doctorIdParamsSchema,
    body: approveDoctorBodySchema,
});
