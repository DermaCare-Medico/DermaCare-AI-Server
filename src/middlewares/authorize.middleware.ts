
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/errors/AppError.js";
import type { Role } from "../generated/prisma/client.js";

// Use after authenticate: authorize("ADMIN"), authorize("DOCTOR", "ADMIN")
export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return next(new AppError("You do not have access to this resource", 403));
    }
    next();
  };
