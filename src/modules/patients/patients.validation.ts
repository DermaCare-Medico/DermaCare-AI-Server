import { z } from "zod";

import { Gender } from "../../generated/prisma/enums.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { uuidSchema } from "../../shared/validators/common.validator.js";

const dateSchema = z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must use YYYY-MM-DD format")
    .refine((value: string) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(date.getTime())
            && date.toISOString().slice(0, 10) === value;
    }, "dateOfBirth must be a valid date")
    .refine(
        (value: string) => new Date(`${value}T00:00:00.000Z`) <= new Date(),
        "dateOfBirth cannot be in the future",
    );

const updatePatientProfileSchema = z.object({
    dateOfBirth: dateSchema.nullable().optional(),
    gender: z.enum(Gender).nullable().optional(),
    address: z.string().nullable().optional(),
    allergies: z.array(z.string()).optional(),
    existingConditions: z.array(z.string()).optional(),
}).strict();

const medicationDateSchema = z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
    .refine((value: string) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(date.getTime())
            && date.toISOString().slice(0, 10) === value;
    }, "Date must be valid");

const createMedicationSchema = z.object({
    medicineName: z.string().trim().min(1).max(200),
    dosage: z.string().trim().min(1).max(100).nullable().optional(),
    frequency: z.string().trim().min(1).max(100).nullable().optional(),
    startDate: medicationDateSchema.nullable().optional(),
    endDate: medicationDateSchema.nullable().optional(),
    notes: z.string().trim().min(1).nullable().optional(),
}).strict().refine(
    (value) => !value.startDate || !value.endDate || value.endDate >= value.startDate,
    {
        path: ["endDate"],
        message: "endDate cannot be before startDate",
    },
);

export type CreateMedicationInput = z.infer<typeof createMedicationSchema>;

const updateMedicationSchema = z.object({
    medicineName: z.string().trim().min(1).max(200).optional(),
    dosage: z.string().trim().min(1).max(100).nullable().optional(),
    frequency: z.string().trim().min(1).max(100).nullable().optional(),
    startDate: medicationDateSchema.nullable().optional(),
    endDate: medicationDateSchema.nullable().optional(),
    notes: z.string().trim().min(1).nullable().optional(),
}).strict().refine(
    (value) => Object.keys(value).length > 0,
    "At least one medication field is required",
).refine(
    (value) => !value.startDate || !value.endDate || value.endDate >= value.startDate,
    {
        path: ["endDate"],
        message: "endDate cannot be before startDate",
    },
);

const medicationIdParamsSchema = z.object({
    id: uuidSchema,
}).strict();

export type UpdateMedicationInput = z.infer<typeof updateMedicationSchema>;

export const validateUpdatePatientProfile = validateRequest({
    body: updatePatientProfileSchema,
});

export const validateCreateMedication = validateRequest({
    body: createMedicationSchema,
});

export const validateUpdateMedication = validateRequest({
    params: medicationIdParamsSchema,
    body: updateMedicationSchema,
});
