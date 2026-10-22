import type { Request, Response } from "express";
import { AppError } from "../../../shared/errors/AppError.js";
import { openAppointmentConversation } from "../services/conversation.service.js";
import { appointmentConversationParamsSchema } from "../conversations.validation.js";

export async function openAppointmentConversationController(req: Request, res: Response) {
  if (!req.auth) throw new AppError("Authentication required", 401);
  const { appointmentId } = appointmentConversationParamsSchema.parse(req.params);
  const data = await openAppointmentConversation(req.auth.userId, appointmentId);
  res.status(200).json({ success: true, data });
}
