
import type { Request, Response, NextFunction } from "express";
import {
  applicationIdParamsSchema,
  rejectDoctorApplicationSchema,
} from "../doctors.validation.js";
import {
  approveDoctorApplication,
  getPendingDoctorApplications,
  rejectDoctorApplication,
} from "../doctor.service.js";
import { AppError } from "../../../shared/errors/AppError.js";

export const doctorApprovalController = {
  getPendingApplications: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 10);

      if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid page or limit",
        });
        return;
      }

      const result = await getPendingDoctorApplications(page, limit);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },

  approve: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {

        if (!req.auth) {
  throw new AppError("Authentication required", 401);
}
      const { applicationId } = applicationIdParamsSchema.parse(req.params);

      const result = await approveDoctorApplication(
        req.auth.userId,
        applicationId,
      );

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },

  reject: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { applicationId } = applicationIdParamsSchema.parse(req.params);
      const input = rejectDoctorApplicationSchema.parse(req.body);

      const result = await rejectDoctorApplication(applicationId, input);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },
};
