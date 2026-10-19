import { z } from "zod";

import { Gender } from "../../generated/prisma/enums.js";
import { validateRequest } from "../../middlewares/validateRequest.js";

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

export const validateUpdatePatientProfile = validateRequest({
    body: updatePatientProfileSchema,
});
