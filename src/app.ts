
import express from "express";
import { env } from "./config/env.js";
import { security } from "./middlewares/security.js";
import { httpLogger } from "./shared/logger/httpLogger.js";
import { errorHandler } from "./shared/errors/errorHandler.js";
import { notFound } from "./shared/errors/notFound.js";
import apiRouter from "./routes/index.js";
import docsRouter from "./docs/docs.routes.js";
import { asyncHandler } from "./middlewares/asyncHandler.js";
import { paymentWebhookController } from "./modules/payments/controllers/payment-webhook.controller.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);

app.use(security);
app.use(httpLogger);
app.post(
  "/api/v1/payments/stripe/webhook",
  express.raw({ type: "application/json", limit: "5mb" }),
  asyncHandler(paymentWebhookController.handleStripeWebhook),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get(["/", "/health"], (_req, res) => {
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Service is healthy",
    data: {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// Actual backend routes
app.use("/api/v1", apiRouter);

// Documentation-only endpoints
app.use(docsRouter);

// Keep these last
app.use(notFound);
app.use(errorHandler);

export default app;
