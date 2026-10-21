
import type { Request, Response } from "express";
import { AppError } from "../../../shared/errors/AppError.js";
import { createScreening } from "../services/screening-questionnaire.service.js";
import { createScreeningSchema } from "../screenings.validation.js";

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
    parsed.data,
  );

  return res.status(201).json({
    success: true,
    message: "Screening created successfully",
    data: screening,
  });
}
