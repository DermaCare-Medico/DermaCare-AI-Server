import type { Request, Response } from "express";

import { env } from "../../../config/env.js";
import { AUTH_TOKEN } from "../../../shared/constants/auth.constants.js";
import { AppError } from "../../../shared/errors/AppError.js";

export const REFRESH_COOKIE_NAME = "dermacare_refresh";

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/v1/auth",
  maxAge: AUTH_TOKEN.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
};

export const setRefreshCookie = (res: Response, refreshToken?: string) => {
  if (refreshToken) res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
};

export const clearRefreshCookie = (res: Response) => {
  const { maxAge: _maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie(REFRESH_COOKIE_NAME, clearOptions);
};

const cookieValue = (header: string | undefined, name: string) => {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
};

export const refreshTokenOf = (req: Request): string => {
  const bodyToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
  const token = bodyToken ?? cookieValue(req.get("cookie"), REFRESH_COOKIE_NAME);
  if (!token || token.length < 20 || token.length > 200) {
    throw new AppError("Refresh token is required", 401);
  }
  return token;
};
