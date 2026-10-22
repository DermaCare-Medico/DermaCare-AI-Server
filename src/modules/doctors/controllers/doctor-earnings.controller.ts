import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import {
  doctorEarningsHistoryQuerySchema,
  doctorPayoutListQuerySchema,
} from "../doctors.validation.js";
import {
  getDoctorEarningsHistory,
  getDoctorEarningsSummary,
  getDoctorPayoutHistory,
} from "../services/doctor-earnings.service.js";

function getUserId(req: Request) {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
  }
  return userId;
}

export async function getDoctorEarningsSummaryController(
  req: Request,
  res: Response,
) {
  const data = await getDoctorEarningsSummary(getUserId(req));
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    statusCode: HTTP_STATUS.OK,
    message: "Doctor earnings summary retrieved successfully",
    data,
  });
}

export async function getDoctorEarningsHistoryController(
  req: Request,
  res: Response,
) {
  const query = doctorEarningsHistoryQuerySchema.parse(req.query);
  const result = await getDoctorEarningsHistory(getUserId(req), query);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    statusCode: HTTP_STATUS.OK,
    message: "Doctor earnings history retrieved successfully",
    data: result.items,
    pagination: result.pagination,
  });
}

export async function getDoctorPayoutHistoryController(
  req: Request,
  res: Response,
) {
  const query = doctorPayoutListQuerySchema.parse(req.query);
  const result = await getDoctorPayoutHistory(getUserId(req), query);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    statusCode: HTTP_STATUS.OK,
    message: "Doctor payouts retrieved successfully",
    data: result.payouts,
    pagination: result.pagination,
  });
}

export const doctorEarningsController = {
  getEarningsSummary: getDoctorEarningsSummaryController,
  getEarningsHistory: getDoctorEarningsHistoryController,
  getPayoutHistory: getDoctorPayoutHistoryController,
};

