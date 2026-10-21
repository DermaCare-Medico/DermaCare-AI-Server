
import type { Request, Response } from "express";
import { AppError } from "../../../shared/errors/AppError.js";
import { retryFailedScreening } from "../services/screening-prediction.service.js";
import { screeningIdParamsSchema } from "../screenings.validation.js";

export async function processScreeningPredictionController(
  req: Request,
  res: Response,
) {
  if (!req.auth) {
    throw new AppError("Authentication required", 401);
  }

  const { screeningId } = screeningIdParamsSchema.parse(req.params);
  const data = await retryFailedScreening(req.auth.userId, screeningId);
  res.status(200).json({
    success: true,
    message: "Screening inference retry completed",
    data,
  });
}
