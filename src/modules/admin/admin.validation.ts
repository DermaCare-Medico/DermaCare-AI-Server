import { z } from "zod";

import {
    AccountStatus,
    AppointmentStatus,
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

export type AdminMedicineListQuery = {
    page: number;
    limit: number;
    search?: string;
    lowStock?: boolean;
    isAvailable?: boolean;
};

export type CreateMedicineInput = {
    name: string;
    strength?: string;
    description?: string;
    price: number;
    stockQuantity: number;
    requiresPrescription: boolean;
};

export type UpdateMedicineInput = {
    name?: string;
    strength?: string | null;
    description?: string | null;
    price?: number;
    stockQuantity?: number;
    requiresPrescription?: boolean;
    isAvailable?: boolean;
};

export type AdminAppointmentListQuery = {
    page: number;
    limit: number;
    status?: AppointmentStatus;
    doctorId?: string;
    patientId?: string;
};

export type AdminAuditLogListQuery = {
    page: number;
    limit: number;
    dateFrom?: Date;
    dateTo?: Date;
    actorUserId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
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
        OrderStatus.PACKED,
        OrderStatus.OUT_FOR_DELIVERY,
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

const rejectDoctorBodySchema = z.object({
    reason: z.string().trim().min(3).max(1000),
}).strict();

const booleanQueryValue = z.enum(["true", "false"]).transform((value) => value === "true");

const medicineListQuerySchema = z.object({
    ...paginationShape,
    search: z.string().trim().min(1).max(200).optional(),
    lowStock: booleanQueryValue.optional(),
    isAvailable: booleanQueryValue.optional(),
}).strict();

const createMedicineSchema = z.object({
    name: z.string().trim().min(2).max(200),
    strength: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().min(1).max(2000).optional(),
    price: z.coerce.number().positive().max(99999999.99),
    stockQuantity: z.coerce.number().int().min(0),
    requiresPrescription: z.boolean(),
}).strict();

const medicineIdParamsSchema = z.object({ id: uuidSchema }).strict();

const updateMedicineSchema = z.object({
    name: z.string().trim().min(2).max(200).optional(),
    strength: z.string().trim().min(1).max(100).nullable().optional(),
    description: z.string().trim().min(1).max(2000).nullable().optional(),
    price: z.coerce.number().positive().max(99999999.99).optional(),
    stockQuantity: z.coerce.number().int().min(0).optional(),
    requiresPrescription: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
}).strict().refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    { message: "At least one medicine field is required" },
);

const appointmentListAdminQuerySchema = z.object({
    ...paginationShape,
    status: z.enum(AppointmentStatus).optional(),
    doctorId: uuidSchema.optional(),
    patientId: uuidSchema.optional(),
}).strict();

const appointmentIdAdminParamsSchema = z.object({ id: uuidSchema }).strict();

const auditLogListQuerySchema = z.object({
    ...paginationShape,
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    actorUserId: uuidSchema.optional(),
    action: z.string().trim().min(1).max(100).optional(),
    entityType: z.string().trim().min(1).max(100).optional(),
    entityId: uuidSchema.optional(),
}).strict().refine(
    (value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
    { message: "dateFrom must be before or equal to dateTo", path: ["dateFrom"] },
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
export const validateAdminDoctorRejection = validateRequest({
    params: doctorIdParamsSchema,
    body: rejectDoctorBodySchema,
});
export const validateAdminMedicineList = validateRequest({ query: medicineListQuerySchema });
export const validateAdminMedicineCreate = validateRequest({ body: createMedicineSchema });
export const validateAdminMedicineId = validateRequest({ params: medicineIdParamsSchema });
export const validateAdminMedicineUpdate = validateRequest({
    params: medicineIdParamsSchema,
    body: updateMedicineSchema,
});
export const validateAdminAppointmentList = validateRequest({
    query: appointmentListAdminQuerySchema,
});
export const validateAdminAppointmentId = validateRequest({
    params: appointmentIdAdminParamsSchema,
});
export const validateAdminAuditLogList = validateRequest({ query: auditLogListQuerySchema });
