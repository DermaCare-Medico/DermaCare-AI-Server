
import type { Request } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { redis } from "../shared/redis/redis.client.js";
import { AUTH_RATE_LIMITS } from "../shared/constants/auth.constants.js";

// Redis-backed store compatible with express-rate-limit.
class UpstashRateLimitStore {
  readonly prefix: string;

  constructor(
    private readonly windowMs: number,
    prefix: string,
  ) {
    this.prefix = prefix;
  }

  private key(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async increment(key: string) {
    const redisKey = this.key(key);

    const script = `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
      end
      local ttl = redis.call('PTTL', KEYS[1])
      return { count, ttl }
    `;

const result = await redis.eval<[number], [number, number]>(
  script,
  [redisKey],
  [this.windowMs],
);

const totalHits = Number(result[0]);
const ttl = Number(result[1]);

    return {
      totalHits,
      resetTime: new Date(
        Date.now() + (ttl >= 0 ? ttl : this.windowMs),
      ),
    };
  }

  async decrement(key: string): Promise<void> {
    const redisKey = this.key(key);

    const script = `
      local count = redis.call('DECR', KEYS[1])
      if count <= 0 then
        redis.call('DEL', KEYS[1])
      end
      return count
    `;

    await redis.eval<[],number>(script, [redisKey], []);
  }

  async resetKey(key: string): Promise<void> {
    await redis.del(this.key(key));
  }
}

const createRateLimiter = (
  windowMs: number,
  limit: number,
  message: string,
  prefix: string,
) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    store: new UpstashRateLimitStore(windowMs, prefix),
    message: {
      success: false,
      message,
    },
  });

// Needs express.json() to run before it, so req.body is available.
const emailOf = (req: Request): string =>
  String(req.body?.email ?? "")
    .trim()
    .toLowerCase();

export const generalAuthLimiter = createRateLimiter(
  AUTH_RATE_LIMITS.GENERAL.WINDOW_MS,
  AUTH_RATE_LIMITS.GENERAL.MAX_REQUESTS,
  "Too many authentication requests. Please try again later.",
  "DermaCare-AI:auth:general",
);

export const otpSendLimiter = createRateLimiter(
  AUTH_RATE_LIMITS.OTP_SEND.WINDOW_MS,
  AUTH_RATE_LIMITS.OTP_SEND.MAX_REQUESTS,
  "Too many OTP requests. Please try again later.",
  "DermaCare-AI:auth:otp-send",
);

export const otpVerifyLimiter = createRateLimiter(
  AUTH_RATE_LIMITS.OTP_VERIFY.WINDOW_MS,
  AUTH_RATE_LIMITS.OTP_VERIFY.MAX_REQUESTS,
  "Too many OTP verification attempts. Please try again later.",
  "DermaCare-AI:auth:otp-verify",
);

export const passwordResetLimiter = createRateLimiter(
  AUTH_RATE_LIMITS.PASSWORD_RESET.WINDOW_MS,
  AUTH_RATE_LIMITS.PASSWORD_RESET.MAX_REQUESTS,
  "Too many password reset requests. Please try again later.",
  "DermaCare-AI:auth:password-reset",
);

// Per email: stops one inbox being flooded from many IPs.
export const otpEmailLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMITS.OTP_SEND.WINDOW_MS,
  limit: AUTH_RATE_LIMITS.OTP_SEND.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  store: new UpstashRateLimitStore(
    AUTH_RATE_LIMITS.OTP_SEND.WINDOW_MS,
    "DermaCare-AI:auth:otp-email",
  ),
  keyGenerator: (req) =>
    emailOf(req) || ipKeyGenerator(req.ip ?? ""),
  message: {
    success: false,
    message:
      "Too many OTP requests for this email. Please try again later.",
  },
});

// Per IP + email, counts failed logins only.
export const loginFailureLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMITS.LOGIN_FAILED.WINDOW_MS,
  limit: AUTH_RATE_LIMITS.LOGIN_FAILED.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: new UpstashRateLimitStore(
    AUTH_RATE_LIMITS.LOGIN_FAILED.WINDOW_MS,
    "DermaCare-AI:auth:login-failure",
  ),
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip ?? "")}:${emailOf(req)}`,
  message: {
    success: false,
    message:
      "Too many failed login attempts. Please try again later.",
  },
});
