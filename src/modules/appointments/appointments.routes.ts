import { Router } from "express";
import { Role } from "../../generated/prisma/client.js";
import { authorize } from "../../middlewares/authorize.middleware.js";

import { asyncHandler } from "../../middlewares/asyncHandler.middleware.js";
import { appointmentController } from "./controllers/appointment.controller.js";
import {
    validateAppointmentId,
    validateAppointmentListQuery,
    validateCancellationDecision,
    validateCancellationRequest,
    validateCreateAppointment,
    validateDirectCancel,
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

// Cancellation and lifecycle transitions
appointmentRouter.post(
    "/appointments/:id/cancellation-request",
    authorize(Role.PATIENT),
    validateCancellationRequest,
    asyncHandler(appointmentController.requestCancellationController),
);
appointmentRouter.patch(
    "/appointments/:id/cancellation",
    authorize(Role.DOCTOR, Role.ADMIN),
    validateCancellationDecision,
    asyncHandler(appointmentController.reviewCancellationController),
);
appointmentRouter.post(
    "/appointments/:id/cancel",
    authorize(Role.PATIENT, Role.DOCTOR, Role.ADMIN),
    validateDirectCancel,
    asyncHandler(appointmentController.cancelAppointmentController),
);
appointmentRouter.patch(
    "/appointments/:id/no-show",
    authorize(Role.DOCTOR, Role.ADMIN),
    validateAppointmentId,
    asyncHandler(appointmentController.markNoShowController),
);

export default appointmentRouter;
