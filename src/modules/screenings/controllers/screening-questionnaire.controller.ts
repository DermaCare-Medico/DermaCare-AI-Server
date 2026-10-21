
import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../../shared/errors/AppError.js";
import { createScreening } from "../services/screening-questionnaire.service.js";

const createScreeningSchema = z.object({
  symptoms: z.string().trim().max(5000).optional(),
});

export async function createScreeningController(
  req: Request,
  res: Response,
) {
  if (!req.auth) {
    throw new AppError("Authentication required", 401);
  }

  const parsed = createScreeningSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError("Invalid screening input", 400);
  }

  const screening = await createScreening(
    req.auth.userId,
    parsed.data.symptoms,
  );

  return res.status(201).json({
    success: true,
    message: "Screening created successfully",
    data: screening,
  });
}
