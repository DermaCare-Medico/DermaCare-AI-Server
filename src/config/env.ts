
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
    // Server
      PORT: z.coerce.number().int().min(1).max(65535).default(4000),

    // Store
      LOW_STOCK_THRESHOLD: z.coerce.number().int().nonnegative().default(10),
      
    // JWT
    JWT_ACCESS_SECRET: z.string().min(96),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),

    // OTP
    OTP_SECRET: z.string().min(96),

    // Google authentication (optional until implemented)
    GOOGLE_CLIENT_ID: optionalString,

    // Google Calendar / Meet (optional; failures remain retryable)
    GOOGLE_CALENDAR_CLIENT_ID: optionalString,
    GOOGLE_CALENDAR_CLIENT_SECRET: optionalString,
    GOOGLE_CALENDAR_REDIRECT_URI: optionalString,
    GOOGLE_CALENDAR_REFRESH_TOKEN: optionalString,
    GOOGLE_CALENDAR_ID: z.string().default("primary"),

    // SMTP email configuration
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    MAIL_FROM: optionalString,

       // CORS
    CORS_ORIGIN: z.string().default("http://localhost:3000"),

    // trust proxy (for reverse proxies like Nginx)
    TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),
  })
  .superRefine((values, ctx) => {
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
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:");
  console.error(result.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}



export const env = result.data;
