
import { z } from "zod";

export const doctorApplicationSchema = z.object({
  licenseNumber: z.string().trim().min(3).max(100),
  qualifications: z.array(z.string().trim().min(1)).min(1).max(20),
  experienceYears: z.number().int().min(0).max(70),
  consultationFee: z.number().min(0).max(1000000),
  bio: z.string().trim().max(2000).optional(),
  specializationIds: z.array(z.string().uuid()).min(1).max(20),
});

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
export type RejectDoctorApplicationInput = z.infer<
  typeof rejectDoctorApplicationSchema
>;
