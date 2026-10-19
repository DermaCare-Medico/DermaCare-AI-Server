import type { Request } from "express";
import { AppError } from "../../../shared/errors/AppError.js";
import type { RequestMeta } from "../../../types/auth.types.js";

export const metaOf = (req: Request): RequestMeta => ({
  userAgent: req.get("user-agent") ?? undefined,
  ipAddress: req.ip,
});

export const userIdOf = (req: Request): string => {
  if (!req.auth) throw new AppError("Authentication required", 401);
  return req.auth.userId;
};