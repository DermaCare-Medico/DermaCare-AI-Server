
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

    // JWT
    JWT_ACCESS_SECRET: z.string().min(96),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),

    // OTP
    OTP_SECRET: z.string().min(96),

    // Google authentication (optional until implemented)
    GOOGLE_CLIENT_ID: optionalString,

    // SMTP email configuration
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    MAIL_FROM: optionalString,
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
