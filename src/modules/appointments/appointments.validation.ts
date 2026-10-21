import { z } from "zod";

import { AppointmentStatus } from "../../generated/prisma/enums.js";
import { validateRequest } from "../../middlewares/validateRequest.middleware.js";
import { uuidSchema } from "../../shared/validators/common.validator.js";

export type CreateAppointmentInput = {
    doctorId: string;
    slotId: string;
    screeningId?: string;
    historySharingConsent?: boolean;
};

export type AppointmentListQuery = {
    page: number;
    limit: number;
    status?: AppointmentStatus;
};

const createAppointmentSchema = z.object({
    doctorId: uuidSchema,
    slotId: uuidSchema,
    screeningId: uuidSchema.optional(),
    historySharingConsent: z.boolean().optional(),
}).strict();

const appointmentListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(AppointmentStatus).optional(),
}).strict();

const appointmentIdParamsSchema = z.object({
    id: uuidSchema,
}).strict();

export const validateCreateAppointment = validateRequest({
    body: createAppointmentSchema,
});

export const validateAppointmentListQuery = validateRequest({
    query: appointmentListQuerySchema,
});

export const validateAppointmentId = validateRequest({
    params: appointmentIdParamsSchema,
});
