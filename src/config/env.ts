import "dotenv/config";
import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),

    // Database
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // Server
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),

    // Store
    LOW_STOCK_THRESHOLD: z.coerce.number().int().nonnegative().default(10),

    // JWT
    JWT_ACCESS_SECRET: z.string().min(96),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),

    // OTP
    OTP_SECRET: z.string().min(96),

    // Google authentication
    GOOGLE_CLIENT_ID: optionalString,

    // Google Calendar / Meet (optional; failures remain retryable)
    GOOGLE_CALENDAR_CLIENT_ID: optionalString,
    GOOGLE_CALENDAR_CLIENT_SECRET: optionalString,
    GOOGLE_CALENDAR_REDIRECT_URI: optionalString,
    GOOGLE_CALENDAR_REFRESH_TOKEN: optionalString,
    GOOGLE_CALENDAR_OAUTH_TRANSFER_SECRET: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(32).optional(),
    ),
    GOOGLE_CALENDAR_ID: z.string().default("primary"),

    // Stripe Checkout (optional; checkout endpoints report unavailable when omitted)
    STRIPE_SECRET_KEY: optionalString,
    STRIPE_WEBHOOK_SECRET: optionalString,
    CLIENT_URL: z.string().url().default("http://localhost:3000"),

    // Demo Payments (Must be explicitly enabled for local dev/testing; strictly forbidden in production)
    ALLOW_DEMO_PAYMENTS: z.preprocess(
      (val) => (val === "true" || val === true),
      z.boolean(),
    ).default(false),

    // Google Apps Script email delivery
    GOOGLE_APPS_SCRIPT_URL: z.string().trim().url().min(1),
    GOOGLE_APPS_SCRIPT_SECRET: z.string().trim().min(1),

    // CORS
    CORS_ORIGIN: z.string().default("http://localhost:3000"),

    // Trust proxy
    TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),

    // Cloudinary Image Storage
    CLOUDINARY_CLOUD_NAME: optionalString,
    CLOUDINARY_API_KEY: optionalString,
    CLOUDINARY_API_SECRET: optionalString,
  })
  .superRefine((values, ctx) => {
    if (values.NODE_ENV === "production" && values.ALLOW_DEMO_PAYMENTS) {
      ctx.addIssue({
        code: "custom",
        path: ["ALLOW_DEMO_PAYMENTS"],
        message: "ALLOW_DEMO_PAYMENTS cannot be enabled in production",
      });
    }
    const cloudinaryValues = [
      values.CLOUDINARY_CLOUD_NAME,
      values.CLOUDINARY_API_KEY,
      values.CLOUDINARY_API_SECRET,
    ];
    const hasAnyCloudinary = cloudinaryValues.some(Boolean);
    const hasAllCloudinary = cloudinaryValues.every(Boolean);

    if (hasAnyCloudinary && !hasAllCloudinary) {
      ctx.addIssue({
        code: "custom",
        path: ["CLOUDINARY_CLOUD_NAME"],
        message: "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must all be configured together",
      });
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:");
  console.error(result.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}

export const env = result.data;
