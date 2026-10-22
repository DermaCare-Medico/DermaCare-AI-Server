
import nodemailer from "nodemailer";

import { env } from "../../config/env.js";
import { AppError } from "../errors/AppError.js";
import { AUTH_OTP } from "../constants/auth.constants.js";
import { otpEmailTemplate } from "./email-templates/otp-email.template.js";

type MailError = Error & {
  code?: string;
  command?: string;
};

const transporter = env.EMAIL_GOOGLE_USER
  ? nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        type: "OAuth2",
        user: env.EMAIL_GOOGLE_USER,
        clientId: env.EMAIL_GOOGLE_CLIENT_ID,
        clientSecret: env.EMAIL_GOOGLE_CLIENT_SECRET,
        refreshToken: env.EMAIL_GOOGLE_REFRESH_TOKEN,
      },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    })
  : env.SMTP_HOST
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
            }
          : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
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
  userName?: string | null,
): Promise<void> => {
  if (!transporter) {
<<<<<<< HEAD
    if (env.NODE_ENV === "production") {
      throw new AppError("Email delivery service is currently unavailable", 503);
    }

    // In development / test mode without SMTP configured, mock dispatch safely.
    // Never log the OTP code or full recipient in production/staging.
    console.info(`[email:dev] Mock email dispatch for ${purpose} to masked recipient`);
    return;
=======
    throw new AppError("Email service is not configured", 500);
>>>>>>> 82ec859397c855eeec47d1624c70e729bdecfb6d
  }

  const minutes = AUTH_OTP.TTL_MS / 60_000;

  // Prefer the user's real name; otherwise use the email username.
  const displayName =
    userName?.trim() || to.split("@")[0]?.trim() || "there";

  try {
    const info = await transporter.sendMail({
      from: env.EMAIL_GOOGLE_USER ?? env.MAIL_FROM,
      to,
      subject: SUBJECTS[purpose],
      text: `Your code is ${code}. It is valid for ${minutes} minutes. If you did not request it, ignore this email.`,
      html: otpEmailTemplate({
        code,
        purpose,
        expiresInMinutes: minutes,
        userName: displayName,
      }),
    });

    if (info.accepted.length === 0) {
      throw new AppError("Email could not be delivered", 502);
    }

    // Log delivery metadata only. Never log OTPs or recipients.
    // OTP-related console output has intentionally been removed.
  } catch (error: unknown) {
    const mailError =
      error instanceof Error ? (error as MailError) : undefined;

    console.error("[Email] Sending failed", {
      purpose,
      code: mailError?.code,
      command: mailError?.command,
      name: mailError?.name ?? "UnknownError",
    });

    throw error;
  }
};
