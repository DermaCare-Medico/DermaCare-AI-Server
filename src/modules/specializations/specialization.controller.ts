import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../shared/constants/http-status.js";
import { listSpecializations } from "./specialization.service.js";

export const specializationController = {
  list: async (_req: Request, res: Response) => {
    const specializations = await listSpecializations();

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: "Specializations retrieved successfully",
      data: specializations,
    });
  },
};
