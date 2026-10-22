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

    // SMTP email configuration
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    MAIL_FROM: optionalString,

    // Gmail OAuth2 email configuration
    EMAIL_GOOGLE_USER: optionalString,
    EMAIL_GOOGLE_CLIENT_ID: optionalString,
    EMAIL_GOOGLE_CLIENT_SECRET: optionalString,
    EMAIL_GOOGLE_REFRESH_TOKEN: optionalString,

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
    if (values.SMTP_HOST && !values.MAIL_FROM) {
      ctx.addIssue({
        code: "custom",
        path: ["MAIL_FROM"],
        message: "MAIL_FROM is required when SMTP_HOST is configured",
      });
    }

    if (values.SMTP_USER && !values.SMTP_PASS) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_PASS"],
        message: "SMTP_PASS is required when SMTP_USER is configured",
      });
    }

    const emailGoogleValues = [
      values.EMAIL_GOOGLE_USER,
      values.EMAIL_GOOGLE_CLIENT_ID,
      values.EMAIL_GOOGLE_CLIENT_SECRET,
      values.EMAIL_GOOGLE_REFRESH_TOKEN,
    ];

    const hasAnyEmailGoogleValue = emailGoogleValues.some(Boolean);
    const hasAllEmailGoogleValues = emailGoogleValues.every(Boolean);

    if (hasAnyEmailGoogleValue && !hasAllEmailGoogleValues) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_GOOGLE_REFRESH_TOKEN"],
        message: "All EMAIL_GOOGLE_* variables must be configured together",
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
