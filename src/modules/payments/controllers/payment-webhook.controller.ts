import type { Request, Response } from "express";
import { AppError } from "../../../shared/errors/AppError.js";
import { paymentWebhookService } from "../services/payment-webhook.service.js";

const handleStripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") throw new AppError("Stripe signature is required", 400);
  if (!Buffer.isBuffer(req.body)) throw new AppError("Stripe webhook requires a raw body", 400);
  const event = paymentWebhookService.verifyStripeEvent(req.body, signature);
  await paymentWebhookService.processStripeEvent(event);
  res.status(200).json({ received: true });
};

export const paymentWebhookController = { handleStripeWebhook };
