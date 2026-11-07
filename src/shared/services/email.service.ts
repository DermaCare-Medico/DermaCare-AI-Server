import { env } from "../../config/env.js";
import { AppError } from "../errors/AppError.js";
import { AUTH_OTP } from "../constants/auth.constants.js";
import { otpEmailTemplate } from "./email-templates/otp-email.template.js";

const SUBJECTS = { EMAIL_VERIFICATION: "Verify your DermaCare AI account", PASSWORD_RESET: "Reset your DermaCare AI password" } as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_TIMEOUT_MS = 15_000;
const RESPONSE_BODY_LOG_LIMIT = 1_000;

const diagnosticBody = (body: string): string => body.slice(0, RESPONSE_BODY_LOG_LIMIT);

const requestSignal = (): AbortSignal => {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return controller.signal;
};

export const sendOtpEmail = async (to: string, code: string, purpose: keyof typeof SUBJECTS, userName?: string | null): Promise<void> => {
  if (!EMAIL_PATTERN.test(to)) throw new AppError("Email could not be delivered", 400);
  const minutes = AUTH_OTP.TTL_MS / 60_000;
  const body = `Your code is ${code}. It is valid for ${minutes} minutes. If you did not request it, ignore this email.`;
  const htmlBody = otpEmailTemplate({
    code,
    purpose,
    expiresInMinutes: minutes,
    userName: userName?.trim() || to.split("@")[0]?.trim() || "there",
  });
  try {
    const response = await fetch(env.GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env.GOOGLE_APPS_SCRIPT_SECRET, to, subject: SUBJECTS[purpose], body, htmlBody }),
      signal: requestSignal(),
    });
    const responseBody = await response.text();
    if (!response.ok) {
      console.error("[Email] Apps Script HTTP failure", {
        status: response.status,
        responseBody: diagnosticBody(responseBody),
      });
      throw new AppError("Email delivery service is currently unavailable", 502);
    }

    let result: unknown;
    try {
      result = JSON.parse(responseBody);
    } catch (error: unknown) {
      console.error("[Email] Apps Script response JSON parsing failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : "Unknown parsing error",
        status: response.status,
        responseBody: diagnosticBody(responseBody),
      });
      throw new AppError("Email delivery service returned an invalid response", 502);
    }
    if (!result || typeof result !== "object" || !("success" in result) || result.success !== true) {
      console.error("[Email] Apps Script reported unsuccessful delivery", {
        status: response.status,
        responseBody: diagnosticBody(responseBody),
      });
      throw new AppError("Email could not be delivered", 502);
    }
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      console.error("[Email] Apps Script response JSON parsing failed", {
        name: error.name,
        message: error.message,
      });
    } else if (error instanceof Error) {
      console.error("[Email] Sending failed", {
        purpose,
        name: error.name,
        message: error.message,
        isTimeout: error.name === "AbortError" || error.name === "TimeoutError",
      });
    } else {
      console.error("[Email] Sending failed", { purpose, name: "UnknownError" });
    }
    throw error;
  }
};
