import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { prescriptionService } from "../services/prescription.service.js";

const getUserId = (req: Request) => {
    const userId = req.auth?.userId;
    if (!userId) {
        throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }
    return userId;
};

const getMyPrescriptionByIdController = async (req: Request, res: Response) => {
    const prescription = await prescriptionService.getPatientPrescriptionById(
        getUserId(req),
        req.params.id!,
    );

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Prescription retrieved successfully",
        data: prescription,
    });
};

export const prescriptionController = {
    getMyPrescriptionByIdController,
};
