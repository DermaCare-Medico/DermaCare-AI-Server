
import { rateLimit } from "express-rate-limit";
import { AUTH_RATE_LIMITS } from "../shared/constants/auth.constants.js";

const createRateLimiter = (
  windowMs: number,
  limit: number,
  message: string,
) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message,
    },
  });

export const generalAuthLimiter = createRateLimiter(
  AUTH_RATE_LIMITS.GENERAL.WINDOW_MS,
  AUTH_RATE_LIMITS.GENERAL.MAX_REQUESTS,
  "Too many authentication requests. Please try again later.",
);

export const otpSendLimiter = createRateLimiter(
  AUTH_RATE_LIMITS.OTP_SEND.WINDOW_MS,
  AUTH_RATE_LIMITS.OTP_SEND.MAX_REQUESTS,
  "Too many OTP requests. Please try again later.",
);

export const otpVerifyLimiter = createRateLimiter(
  AUTH_RATE_LIMITS.OTP_VERIFY.WINDOW_MS,
  AUTH_RATE_LIMITS.OTP_VERIFY.MAX_REQUESTS,
  "Too many OTP verification attempts. Please try again later.",
);

export const passwordResetLimiter = createRateLimiter(
  AUTH_RATE_LIMITS.PASSWORD_RESET.WINDOW_MS,
  AUTH_RATE_LIMITS.PASSWORD_RESET.MAX_REQUESTS,
  "Too many password reset requests. Please try again later.",
);
