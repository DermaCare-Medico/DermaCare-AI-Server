
import { z } from "zod";

export const createScreeningSchema = z.object({
  symptoms: z.string().trim().min(1).max(5000),
  bodyArea: z.string().trim().min(1).max(100).optional(),
  hasBleeding: z.boolean().optional(),
  rapidGrowth: z.boolean().optional(),
  hasFever: z.boolean().optional(),
  hasUlceration: z.boolean().optional(),
  severePain: z.boolean().optional(),
}).strict();

export const screeningImageSchema = z.object({
  screeningId: z.string().uuid(),
  imageType: z.enum(["FRONT", "LEFT", "RIGHT", "OTHER"]),
});

export const screeningIdParamsSchema = z.object({
  screeningId: z.string().uuid(),
});
