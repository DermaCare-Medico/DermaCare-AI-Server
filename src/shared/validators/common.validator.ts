
import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const emailSchema = z
  .string()
  .trim()
  .email("Please provide a valid email address")
  .transform((email) => email.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const idParamsSchema = z.object({
  id: uuidSchema,
});
