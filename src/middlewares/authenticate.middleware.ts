
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/errors/AppError.js";
import { verifyAccessToken } from "../modules/auth/services/token.service.js";
// import { verifyAccessToken } from "../modules/auth/token.service.js";

// Verifies the Bearer access token (signature + expiry) and sets req.auth
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("Authentication required", 401));
  }
  try {
    req.auth = verifyAccessToken(header.slice(7));
    next();
  } catch (e) {
    next(e);
  }
};
