
export const AUTH_RATE_LIMITS = {
  // General protection for login and registration
  GENERAL: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 30,
  },

  // Protect OTP sending endpoints from email spam
  OTP_SEND: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 5,
  },

  // Protect OTP verification endpoints from repeated guesses
  OTP_VERIFY: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 10,
  },

  // Protect password reset requests
  PASSWORD_RESET: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 5,
  },
} as const;
