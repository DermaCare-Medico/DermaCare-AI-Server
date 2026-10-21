
import type { Request, Response } from "express";
import { AppError } from "../../../shared/errors/AppError.js";
import { processScreeningPrediction } from "../services/screening-prediction.service.js";

export async function processScreeningPredictionController(
  req: Request,
  res: Response,
) {
  if (!req.auth) {
    throw new AppError("Authentication required", 401);
  }

  const screeningId = req.params.screeningId;

  if (typeof screeningId !== "string") {
    throw new AppError("Invalid screening ID", 400);
  }

  throw new AppError(
    "Use the image upload endpoint to process a screening.",
    400,
  );
}
