export const AUTH_RATE_LIMITS = {
  // General protection for login and registration
  GENERAL: {
    WINDOW_MS: 15 * 60 * 1000,
    MAX_REQUESTS: 30,
  },

  // Protect OTP sending endpoints from email spam
  OTP_SEND: {
    WINDOW_MS: 15 * 60 * 1000,
    MAX_REQUESTS: 5,
  },

  // Protect OTP verification endpoints from repeated guesses
  OTP_VERIFY: {
    WINDOW_MS: 15 * 60 * 1000,
    MAX_REQUESTS: 10,
  },

  // Protect password reset requests
  PASSWORD_RESET: {
    WINDOW_MS: 15 * 60 * 1000,
    MAX_REQUESTS: 5,
  },

  // Failed logins only (per IP + email)
  LOGIN_FAILED: {
    WINDOW_MS: 15 * 60 * 1000,
    MAX_REQUESTS: 5,
  },
} as const;

export const AUTH_OTP = {
  LENGTH: 6,
  TTL_MS: 5 * 60 * 1000, // valid for 5 minutes
  MAX_ATTEMPTS: 5, // 5 wrong attempts cancel the code
  RESEND_COOLDOWN_MS: 60 * 1000, // new code after 60 seconds
} as const;

export const AUTH_TOKEN = {
  ACCESS_ISSUER: "dermacare-api",
  ACCESS_AUDIENCE: "dermacare-app",
  REFRESH_TTL_DAYS: 30,
} as const;

// Bump when Terms, Privacy or Consent text changes
export const CONSENT_VERSION = "1.0";