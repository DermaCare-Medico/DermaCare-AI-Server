
import { z } from "zod";

export const doctorApplicationSchema = z.object({
  licenseNumber: z.string().trim().min(3).max(100),
  qualifications: z.array(z.string().trim().min(1)).min(1).max(20),
  experienceYears: z.number().int().min(0).max(70),
  consultationFee: z.number().min(0).max(1000000),
  bio: z.string().trim().max(2000).optional(),
  specializationIds: z.array(z.string().uuid()).min(1).max(20),
  documentReferences: z.array(
    z.string().trim().regex(/^DermaCare-AI\/doctor-documents\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)+$/),
  ).min(1).max(10),
}).strict();

export const doctorDocumentIndexParamsSchema = z.object({
  documentIndex: z.coerce.number().int().min(0),
}).strict();

export const doctorProfileUpdateSchema = z.object({
  qualifications: z.array(z.string().trim().min(1)).min(1).max(20).optional(),
  experienceYears: z.number().int().min(0).max(70).optional(),
  consultationFee: z.number().min(0).max(1000000).optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  specializationIds: z.array(z.string().uuid()).min(1).max(20).optional(),
}).strict().refine((input) => Object.keys(input).length > 0, {
  message: "At least one profile field is required",
});

export const doctorAppointmentHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["HELD", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
}).strict();

export const rejectDoctorApplicationSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

export const doctorIdParamsSchema = z.object({
  doctorId: z.string().uuid(),
});

export const applicationIdParamsSchema = z.object({
  applicationId: z.string().uuid(),
});

export const doctorListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  specializationId: z.string().uuid().optional(),
});

export type DoctorApplicationInput = z.infer<
  typeof doctorApplicationSchema
>;
export type DoctorProfileUpdateInput = z.infer<typeof doctorProfileUpdateSchema>;
export type DoctorAppointmentHistoryQuery = z.infer<typeof doctorAppointmentHistoryQuerySchema>;
export type RejectDoctorApplicationInput = z.infer<
  typeof rejectDoctorApplicationSchema
>;

export const createDoctorSlotSchema = z
  .object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
  })
  .refine((data) => data.startTime > new Date(), {
    message: "Slot start time must be in the future",
    path: ["startTime"],
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const updateDoctorSlotSchema = z.object({
  status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
});

export const doctorSlotParamsSchema = z.object({
  slotId: z.string().uuid(),
});

export const doctorAppointmentParamsSchema = z.object({
  appointmentId: z.string().uuid(),
});

export const doctorAppointmentDecisionSchema = z.object({
  action: z.enum(["ACCEPT", "REJECT"]),
  reason: z.string().trim().max(1000).optional(),
});

export const createMedicineRequestSchema = z.object({
  medicineName: z.string().trim().min(1).max(255),
  genericName: z.string().trim().max(255).optional(),
  strength: z.string().trim().max(100).optional(),
  dosageForm: z.string().trim().max(100).optional(),
  manufacturer: z.string().trim().max(255).optional(),
  description: z.string().trim().max(2000).optional(),
});


export const doctorEarningsHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  year: z.coerce.number().int().min(2020).max(2050).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
}).strict();

export const doctorPayoutListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["PENDING", "PROCESSING", "PAID", "FAILED"]).optional(),
}).strict();

export type DoctorEarningsHistoryQuery = z.infer<typeof doctorEarningsHistoryQuerySchema>;
export type DoctorPayoutListQuery = z.infer<typeof doctorPayoutListQuerySchema>;
