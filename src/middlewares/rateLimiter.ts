import type { Request } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
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

// Needs express.json() to run before it, so req.body is available
const emailOf = (req: Request): string =>
  String(req.body?.email ?? "")
    .trim()
    .toLowerCase();

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

// Per email: stops one inbox being flooded from many IPs
export const otpEmailLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMITS.OTP_SEND.WINDOW_MS,
  limit: AUTH_RATE_LIMITS.OTP_SEND.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => emailOf(req) || ipKeyGenerator(req.ip ?? ""),
  message: {
    success: false,
    message: "Too many OTP requests for this email. Please try again later.",
  },
});

// Per IP + email, counts failed logins only
export const loginFailureLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMITS.LOGIN_FAILED.WINDOW_MS,
  limit: AUTH_RATE_LIMITS.LOGIN_FAILED.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "")}:${emailOf(req)}`,
  message: {
    success: false,
    message: "Too many failed login attempts. Please try again later.",
  },
});

export const chatMessageLimiter = createRateLimiter(
  60_000,
  30,
  "Too many messages sent. Please slow down.",
);

export const chatPollingLimiter = createRateLimiter(
  60_000,
  120,
  "Too many chat polling requests. Please slow down.",
);