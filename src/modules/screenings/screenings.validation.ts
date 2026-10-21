
import { z } from "zod";

export const createScreeningSchema = z.object({
  symptoms: z.string().trim().min(1).max(5000),
}).strict();

export const screeningImageSchema = z.object({
  screeningId: z.string().uuid(),
  imageType: z.enum(["FRONT", "LEFT", "RIGHT", "OTHER"]),
});
