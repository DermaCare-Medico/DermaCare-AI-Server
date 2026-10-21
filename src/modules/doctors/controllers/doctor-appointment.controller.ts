import type { Request, Response } from "express";
import {
  decideDoctorAppointment,
  getDoctorAppointmentRequests,
} from "../services/doctor-appointment.service.js";
import { doctorAppointmentDecisionSchema, doctorAppointmentParamsSchema } from "../doctors.validation.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";

function getUserId(req: Request) {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
  }
  return userId;
}

export async function getAppointmentRequestsController(
  req: Request,
  res: Response,
) {
  const data = await getDoctorAppointmentRequests(getUserId(req));
  res.status(HTTP_STATUS.OK).json({ success: true, data });
}

export async function decideAppointmentController(
  req: Request,
  res: Response,
) {
  const { appointmentId } = doctorAppointmentParamsSchema.parse(req.params);
  const input = doctorAppointmentDecisionSchema.parse(req.body);

  const data = await decideDoctorAppointment(
    getUserId(req),
    appointmentId,
    input.action,
    input.reason,
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: `Appointment ${input.action.toLowerCase()}ed successfully`,
    data,
  });
}