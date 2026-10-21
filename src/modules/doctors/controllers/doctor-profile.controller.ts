
import type { Request, Response, NextFunction } from "express";
import { doctorApplicationSchema } from "../doctors.validation.js";
import {
  getMyDoctorProfile,
  submitDoctorApplication,
} from "../doctor.service.js";
import { AppError } from "../../../shared/errors/AppError.js";

export const doctorProfileController = {
  submitApplication: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.auth) {
        throw new AppError("Authentication required", 401);
      }

      const input = doctorApplicationSchema.parse(req.body);

      const result = await submitDoctorApplication(
        req.auth.userId,
        input,
      );

      res.status(201).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },

  getMyProfile: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.auth) {
        throw new AppError("Authentication required", 401);
      }

      const profile = await getMyDoctorProfile(req.auth.userId);

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  },
};
