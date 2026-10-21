import type { Request, Response } from "express";
import {
  createDoctorSlot,
  getMyDoctorSlots,
  updateDoctorSlot,
} from "../services/doctor-slot.service.js";
import {
  createDoctorSlotSchema,
  doctorSlotParamsSchema,
  updateDoctorSlotSchema,
} from "../doctors.validation.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";

function getUserId(req: Request) {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
  }

  return userId;
}

export async function createSlotController(
  req: Request,
  res: Response,
) {
  const input = createDoctorSlotSchema.parse(req.body);
  const slot = await createDoctorSlot(getUserId(req), input);

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: "Slot created successfully",
    data: slot,
  });
}

export async function getMySlotsController(
  req: Request,
  res: Response,
) {
  const slots = await getMyDoctorSlots(getUserId(req));

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: slots,
  });
}

export async function updateSlotController(
  req: Request,
  res: Response,
) {
  const { slotId } = doctorSlotParamsSchema.parse(req.params);
  const { status } = updateDoctorSlotSchema.parse(req.body);

  const slot = await updateDoctorSlot(
    getUserId(req),
    slotId,
    status,
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Slot updated successfully",
    data: slot,
  });
}