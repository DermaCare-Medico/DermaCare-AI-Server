import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { patientService } from "../services/patient.service.js";

const getUserId = (req: Request) => {
    const userId = req.auth?.userId;
    if (!userId) {
        throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }
    return userId;
};

const getMyProfileController = async (req: Request, res: Response) => {
    const result = await patientService.getMyProfile(getUserId(req));

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Patient profile retrieved successfully",
        data: result,
    });
};

const updateMyProfileController = async (req: Request, res: Response) => {
    const updatedPatient = await patientService.updateMyProfile(
        getUserId(req),
        req.body,
    );

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Patient profile updated successfully",
        data: updatedPatient,
    });
};

export const patientController = {
    getMyProfileController,
    updateMyProfileController,
};
