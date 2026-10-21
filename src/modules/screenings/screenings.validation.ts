
import { z } from "zod";

export const screeningImageSchema = z.object({
  screeningId: z.string().uuid(),
  imageType: z.enum(["FRONT", "LEFT", "RIGHT", "OTHER"]),
});
