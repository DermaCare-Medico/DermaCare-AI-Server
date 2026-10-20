import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { medicineService } from "../services/medicine.service.js";

const getAdminUserId = (req: Request) => {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    return userId;
};

const listPublicMedicines = async (req: Request, res: Response) => {
    const result = await medicineService.listPublicMedicines({
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        search: req.query.search as string | undefined,
    });
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Medicines retrieved successfully",
        data: result.medicines,
        pagination: result.pagination,
    });
};

const getPublicMedicine = async (req: Request, res: Response) => {
    const medicine = await medicineService.getPublicMedicine(req.params.id!);
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Medicine retrieved successfully",
        data: medicine,
    });
};

const listMedicinesForAdmin = async (req: Request, res: Response) => {
    const result = await medicineService.listMedicinesForAdmin(getAdminUserId(req), {
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        search: req.query.search as string | undefined,
        lowStock: req.query.lowStock as boolean | undefined,
    });
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Medicines retrieved successfully",
        data: result.medicines,
        pagination: result.pagination,
    });
};

const createMedicineForAdmin = async (req: Request, res: Response) => {
    const medicine = await medicineService.createMedicineForAdmin(getAdminUserId(req), req.body);
    return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        statusCode: HTTP_STATUS.CREATED,
        message: "Medicine created successfully",
        data: medicine,
    });
};

const getMedicineForAdmin = async (req: Request, res: Response) => {
    const medicine = await medicineService.getMedicineForAdmin(
        getAdminUserId(req),
        req.params.id!,
    );
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Medicine retrieved successfully",
        data: medicine,
    });
};

const updateMedicineForAdmin = async (req: Request, res: Response) => {
    const medicine = await medicineService.updateMedicineForAdmin(
        getAdminUserId(req),
        req.params.id!,
        req.body,
    );
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Medicine updated successfully",
        data: medicine,
    });
};

const deactivateMedicineForAdmin = async (req: Request, res: Response) => {
    const medicine = await medicineService.deactivateMedicineForAdmin(
        getAdminUserId(req),
        req.params.id!,
    );
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Medicine deactivated successfully",
        data: medicine,
    });
};

export const medicineController = {
    listPublicMedicines,
    getPublicMedicine,
    listMedicinesForAdmin,
    createMedicineForAdmin,
    getMedicineForAdmin,
    updateMedicineForAdmin,
    deactivateMedicineForAdmin,
};
