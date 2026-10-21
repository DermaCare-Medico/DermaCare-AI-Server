import type { Request, Response } from "express";
import {
  createMedicineRequest,
  getMyMedicineRequests,
} from "../services/doctor-medicine-request.service.js";
import { createMedicineRequestSchema } from "../doctors.validation.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";

function getUserId(req: Request) {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
  }
  return userId;
}

export async function createMedicineRequestController(
  req: Request,
  res: Response,
) {
  const input = createMedicineRequestSchema.parse(req.body);
  const data = await createMedicineRequest(getUserId(req), input);

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: "Medicine request submitted",
    data,
  });
}

export async function getMyMedicineRequestsController(
  req: Request,
  res: Response,
) {
  const data = await getMyMedicineRequests(getUserId(req));
  res.status(HTTP_STATUS.OK).json({ success: true, data });
}