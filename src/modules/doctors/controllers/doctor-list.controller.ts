
import type { Request, Response, NextFunction } from "express";
import {
  doctorIdParamsSchema,
  doctorListQuerySchema,
} from "../doctors.validation.js";
import {
  getApprovedDoctorById,
  getApprovedDoctors,
} from "../doctor.service.js";

export const doctorListController = {
  list: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const query = doctorListQuerySchema.parse(req.query);
      const result = await getApprovedDoctors(query);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },

  getById: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { doctorId } = doctorIdParamsSchema.parse(req.params);
      const doctor = await getApprovedDoctorById(doctorId);

      res.status(200).json({
        success: true,
        data: doctor,
      });
    } catch (error) {
      next(error);
    }
  },
};
