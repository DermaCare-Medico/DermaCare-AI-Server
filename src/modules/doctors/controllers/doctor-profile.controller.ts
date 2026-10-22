
import type { Request, Response, NextFunction } from "express";
import { doctorApplicationSchema, doctorProfileUpdateSchema } from "../doctors.validation.js";
import {
  getMyDoctorProfile,
  submitDoctorApplication,
  updateMyDoctorProfile,
  storeDoctorApplicationDocument,
} from "../doctor.service.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { unlink } from "node:fs/promises";

export const doctorProfileController = {
  uploadApplicationDocument: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw new AppError("Authentication required", 401);
      if (!req.file) throw new AppError("Doctor document image is required", 400);
      const documentReference = await storeDoctorApplicationDocument(req.auth.userId, req.file.path);
      res.status(201).json({ success: true, data: { documentReference } });
    } catch (error) {
      next(error);
    } finally {
      if (req.file?.path) await unlink(req.file.path).catch(() => undefined);
    }
  },
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

  updateMyProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw new AppError("Authentication required", 401);
      const profile = await updateMyDoctorProfile(
        req.auth.userId,
        doctorProfileUpdateSchema.parse(req.body),
      );
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  },
};
