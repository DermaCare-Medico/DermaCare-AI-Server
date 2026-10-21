
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/errors/AppError.js";
import { resolveAccessTokenAccount, verifyAccessToken } from "../modules/auth/services/token.service.js";

// Verifies the Bearer access token (signature + expiry) and sets req.auth
export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("Authentication required", 401));
  }
  try {
    const claims = verifyAccessToken(header.slice(7));
    req.auth = await resolveAccessTokenAccount(claims);
    next();
  } catch (e) {
    next(e);
  }
};
