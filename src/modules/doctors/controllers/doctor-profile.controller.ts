
import type { Request, Response, NextFunction } from "express";
import { doctorApplicationSchema, doctorDocumentIndexParamsSchema, doctorProfileUpdateSchema } from "../doctors.validation.js";
import {
  getMyDoctorProfile,
  submitDoctorApplication,
  updateMyDoctorProfile,
  storeDoctorApplicationDocument,
  downloadMyDoctorDocument,
} from "../doctor.service.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { unlink } from "node:fs/promises";
import { ZodError } from "zod";

export const parseDoctorApplication = (body: unknown) => {
  try {
    return doctorApplicationSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      const field = issue?.path.length ? `${issue.path.join(".")}: ` : "";
      throw new AppError(`Invalid doctor application: ${field}${issue?.message ?? "invalid payload"}`, 400);
    }
    throw error;
  }
};

export const doctorProfileController = {
  downloadApplicationDocument: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw new AppError("Authentication required", 401);
      const { documentIndex } = doctorDocumentIndexParamsSchema.parse(req.params);
      const document = await downloadMyDoctorDocument(req.auth.userId, documentIndex);
      res.set({
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="doctor-document-${documentIndex + 1}"`,
        "Cache-Control": "private, no-store",
      });
      res.status(200).send(document);
    } catch (error) {
      next(error);
    }
  },
  uploadApplicationDocument: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw new AppError("Authentication required", 401);
      if (!req.file) throw new AppError("Doctor document image is required", 400);
      const documentReference = await storeDoctorApplicationDocument(req.auth.userId, req.file.path);
      res.status(201).json({
        success: true,
        message: "Doctor document uploaded; submit the application to enter admin review",
        data: {
          documentReference,
          applicationSubmitted: false,
          submissionEndpoint: "/doctors/application",
        },
      });
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

      const input = parseDoctorApplication(req.body);

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
