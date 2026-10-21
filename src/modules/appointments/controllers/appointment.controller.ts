
import type { Request, Response } from "express";

import { AppointmentStatus } from "../../../generated/prisma/enums.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { appointmentService } from "../services/appointment.service.js";

const getUserId = (req: Request) => {
    const userId = req.auth?.userId;

    if (!userId) {
        throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }

    return userId;
};

const createAppointmentController = async (req: Request, res: Response) => {
    const appointment = await appointmentService.createAppointment(
        getUserId(req),
        req.body,
    );

    return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        statusCode: HTTP_STATUS.CREATED,
        message: "Appointment created successfully",
        data: appointment,
    });
};

const getMyAppointmentsController = async (req: Request, res: Response) => {
    const result = await appointmentService.getMyAppointments(getUserId(req), {
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        status: req.query.status as AppointmentStatus | undefined,
    });

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Appointments retrieved successfully",
        data: result.appointments,
        pagination: result.pagination,
    });
};

const getMyAppointmentByIdController = async (req: Request, res: Response) => {
    const appointment = await appointmentService.getMyAppointmentById(
        getUserId(req),
        req.params.id!,
    );

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Appointment retrieved successfully",
        data: appointment,
    });
};

const getDoctorAppointmentByIdController = async (req: Request, res: Response) => {
    const appointment = await appointmentService.getDoctorAppointmentById(getUserId(req), req.params.id!);
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Appointment retrieved successfully",
        data: appointment,
    });
};

const listAppointmentsForAdmin = async (req: Request, res: Response) => {
    const result = await appointmentService.listAppointmentsForAdmin(
        getUserId(req),
        {
            page: Number(req.query.page),
            limit: Number(req.query.limit),
            status: req.query.status as AppointmentStatus | undefined,
            doctorId: req.query.doctorId as string | undefined,
            patientId: req.query.patientId as string | undefined,
        },
    );

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Appointments retrieved successfully",
        data: result.appointments,
        pagination: result.pagination,
    });
};

const getAppointmentForAdmin = async (req: Request, res: Response) => {
    const appointment = await appointmentService.getAppointmentForAdmin(
        getUserId(req),
        req.params.id!,
    );

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Appointment retrieved successfully",
        data: appointment,
    });
};

export const appointmentController = {
    createAppointmentController,
    getMyAppointmentsController,
    getMyAppointmentByIdController,
    getDoctorAppointmentByIdController,
    listAppointmentsForAdmin,
    getAppointmentForAdmin,
};
