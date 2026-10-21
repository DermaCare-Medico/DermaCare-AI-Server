import { Router } from "express";
import { Role } from "../../generated/prisma/client.js";
import { authorize } from "../../middlewares/authorize.middleware.js";

import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { appointmentController } from "./controllers/appointment.controller.js";
import {
    validateAppointmentId,
    validateAppointmentListQuery,
    validateCreateAppointment,
} from "./appointments.validation.js";

const appointmentRouter = Router();

// Mount this router at the API root after the application's JWT middleware.
appointmentRouter.post(
    "/appointments",
    authorize(Role.PATIENT),
    validateCreateAppointment,
    asyncHandler(appointmentController.createAppointmentController),
);
appointmentRouter.get(
    "/patients/me/appointments",
    authorize(Role.PATIENT),
    validateAppointmentListQuery,
    asyncHandler(appointmentController.getMyAppointmentsController),
);
appointmentRouter.get(
    "/patients/me/appointments/:id",
    authorize(Role.PATIENT),
    validateAppointmentId,
    asyncHandler(appointmentController.getMyAppointmentByIdController),
);
appointmentRouter.get(
    "/doctors/me/appointments/:id",
    authorize(Role.DOCTOR),
    validateAppointmentId,
    asyncHandler(appointmentController.getDoctorAppointmentByIdController),
);

export default appointmentRouter;
