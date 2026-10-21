import type { Request, Response } from "express";
import { recommendDoctorsForScreening } from "../services/doctor-recommendation.service.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";

export async function screeningDoctorRecommendationController(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
  }

  const screeningId = req.params.screeningId;

  if (typeof screeningId !== "string") {
    throw new AppError("Invalid screening ID", HTTP_STATUS.BAD_REQUEST);
  }

  const data = await recommendDoctorsForScreening(userId, screeningId);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data,
  });
}