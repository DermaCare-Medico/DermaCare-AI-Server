import { Router } from "express";

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
    validateCreateAppointment,
    asyncHandler(appointmentController.createAppointmentController),
);
appointmentRouter.get(
    "/patients/me/appointments",
    validateAppointmentListQuery,
    asyncHandler(appointmentController.getMyAppointmentsController),
);
appointmentRouter.get(
    "/patients/me/appointments/:id",
    validateAppointmentId,
    asyncHandler(appointmentController.getMyAppointmentByIdController),
);

export default appointmentRouter;
