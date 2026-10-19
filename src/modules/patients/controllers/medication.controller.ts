import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { medicationService } from "../services/medication.service.js";

const getUserId = (req: Request) => {
    const userId = req.auth?.userId;
    if (!userId) {
        throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }
    return userId;
};

const createMyMedicationController = async (req: Request, res: Response) => {
    const medication = await medicationService.createMyMedication(
        getUserId(req),
        req.body,
    );

    return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        statusCode: HTTP_STATUS.CREATED,
        message: "Medication created successfully",
        data: medication,
    });
};

export const medicationController = {
    createMyMedicationController,
};
