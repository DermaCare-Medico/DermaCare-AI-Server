
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",

  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "accessToken",
      "refreshToken",
      "authorization",
      "headers.authorization",
    ],
    censor: "[REDACTED]",
  },

  ...(process.env.NODE_ENV !== "production"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        },
      }
    : {}),
});

/*
## Example usages
import { logger } from "../shared/logger/logger.js";

logger.info("Server started");
logger.error({ err }, "Failed to fetch conditions");
logger.info({ userId }, "User authenticated");

*/