
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../shared/errors/AppError.js";

// Doctor pages: the license must be added and approved by an Admin.
// Reads the database, so a new approval or rejection applies immediately.
export const requireApprovedDoctor = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.auth) return next(new AppError("Authentication required", 401));

    const profile = await prisma.doctorProfile.findUnique({
      where: { userId: req.auth.userId },
      select: { approvalStatus: true },
    });

    if (!profile) {
      return next(new AppError("Please add your license details first", 403));
    }
    if (profile.approvalStatus === "PENDING") {
      return next(new AppError("Your account is waiting for Admin approval", 403));
    }
    if (profile.approvalStatus === "REJECTED") {
      return next(new AppError("Your doctor application was rejected", 403));
    }
    next();
  } catch (e) {
    next(e);
  }
};
