import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { AppError } from "../errors/AppError.js";
import { AUTH_OTP } from "../constants/auth.constants.js";
import { otpEmailTemplate } from "./email-templates/otp-email.template.js";

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

const SUBJECTS = {
  EMAIL_VERIFICATION: "Verify your DermaCare AI account",
  PASSWORD_RESET: "Reset your DermaCare AI password",
} as const;

export const sendOtpEmail = async (
  to: string,
  code: string,
  purpose: keyof typeof SUBJECTS,
): Promise<void> => {
  if (!transporter) {
    if (env.NODE_ENV === "production") {
      throw new AppError("Email service is not configured", 500);
    }
    // development only: no SMTP configured, so print the code
    console.info(`[DEV] ${purpose} OTP for ${to}: ${code}`);
    return;
  }

  
const minutes = AUTH_OTP.TTL_MS / 60000;

await transporter.sendMail({
  from: env.MAIL_FROM,
  to,
  subject: SUBJECTS[purpose],

  text: `Your code is ${code}. It is valid for ${minutes} minutes. If you did not request it, ignore this email.`,

  html: otpEmailTemplate({
    code,
    purpose,
    expiresInMinutes: minutes,
  }),
});
}