import type { Request, Response } from "express";
import { AppError } from "../../../shared/errors/AppError.js";
import {
  getScreeningHistory,
  getScreeningHistoryItem,
} from "../services/screening-history.service.js";

export async function getScreeningHistoryController(
  req: Request,
  res: Response,
) {
  if (!req.auth) {
    throw new AppError("Authentication required", 401);
  }

  const history = await getScreeningHistory(req.auth.userId);

  return res.status(200).json({
    success: true,
    message: "Screening history retrieved successfully",
    data: history,
  });
}

export async function getScreeningHistoryItemController(
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

  const screening = await getScreeningHistoryItem(
    req.auth.userId,
    screeningId,
  );

  if (!screening) {
    throw new AppError("Screening not found", 404);
  }

  return res.status(200).json({
    success: true,
    message: "Screening retrieved successfully",
    data: screening,
  });
}