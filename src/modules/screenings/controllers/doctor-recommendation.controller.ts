import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../../shared/errors/AppError.js";
import { getScreeningDoctorRecommendations } from "../services/doctor-recommendation.service.js";

export async function getScreeningDoctorRecommendationsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.auth) {
      throw new AppError("Authentication required", 401);
    }

    const screeningId = req.params.screeningId;

    if (
      typeof screeningId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        screeningId,
      )
    ) {
      throw new AppError("Invalid screening ID", 400);
    }

    const data = await getScreeningDoctorRecommendations(
      screeningId,
      req.auth.userId,
    );

    return res.status(200).json({
      success: true,
      message: "Doctor recommendations retrieved successfully",
      data,
    });
  } catch (error) {
    return next(error);
  }
}