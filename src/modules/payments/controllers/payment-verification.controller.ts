import type { Request, Response } from "express";
import { AppError } from "../../../shared/errors/AppError.js";
import { paymentVerificationService } from "../services/payment-verification.service.js";

const userId = (req: Request) => {
  if (!req.auth?.userId) throw new AppError("Unauthorized", 401);
  return req.auth.userId;
};

const createAppointmentCheckout = async (req: Request, res: Response) => {
  const data = await paymentVerificationService.createAppointmentCheckout(userId(req), req.params.id!);
  res.status(201).json({ success: true, statusCode: 201, message: "Checkout session created", data });
};

const createOrderCheckout = async (req: Request, res: Response) => {
  const data = await paymentVerificationService.createOrderCheckout(userId(req), req.params.id!);
  res.status(201).json({ success: true, statusCode: 201, message: "Checkout session created", data });
};

export const paymentVerificationController = { createAppointmentCheckout, createOrderCheckout };
