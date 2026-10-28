import { z } from "zod";

export const prescriptionIdSchema = z.object({ id: z.string().uuid() });
export const appointmentPrescriptionIdSchema = z.object({ id: z.string().uuid() });

const prescriptionDurationSchema = z.union([
  z.string().trim().min(1).max(100),
  z.number().int().positive().transform(String),
]);

export const prescriptionItemSchema = z.object({
  medicineId: z.string().uuid().optional(),
  medicineName: z.string().trim().min(1).max(255),
  dosage: z.string().trim().min(1).max(100),
  frequency: z.string().trim().min(1).max(100),
  duration: prescriptionDurationSchema.optional(),
  durationDays: z.number().int().positive().optional(),
  instructions: z.string().trim().max(2000).optional(),
}).refine((item) => item.duration !== undefined || item.durationDays !== undefined, {
  message: "Duration is required",
  path: ["duration"],
}).transform(({ durationDays, ...item }) => ({
  ...item,
  duration: item.duration ?? String(durationDays),
}));

export const createPrescriptionSchema = z.object({
  findings: z.string().trim().max(5000).optional(),
  diagnosis: z.string().trim().max(5000).optional(),
  advice: z.string().trim().max(5000).optional(),
  doctorNotes: z.string().trim().max(5000).optional(),
  followUp: z.string().trim().max(2000).optional(),
  items: z.array(prescriptionItemSchema).max(50).default([]),
});

export const updatePrescriptionSchema = z.object({
  findings: z.string().trim().max(5000).nullable().optional(),
  diagnosis: z.string().trim().max(5000).nullable().optional(),
  advice: z.string().trim().max(5000).nullable().optional(),
  doctorNotes: z.string().trim().max(5000).nullable().optional(),
  followUp: z.string().trim().max(2000).nullable().optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: "At least one prescription field is required",
});

export const replacePrescriptionItemsSchema = z.object({
  items: z.array(prescriptionItemSchema).min(1).max(50),
});

export const prescriptionListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type PrescriptionItemInput = z.infer<typeof prescriptionItemSchema>;
