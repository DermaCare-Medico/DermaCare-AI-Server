
import { Router } from "express";
import { Role } from "../../generated/prisma/client.js";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { doctorController } from "./doctor.controller.js";

import {
  createSlotController,
  getAvailableSlotsController,
  getMySlotsController,
  updateSlotController,
} from "./controllers/doctor-slot.controller.js";

import {
  completeConsultationController,
  getAppointmentRequestsController,
  decideAppointmentController,
} from "./controllers/doctor-appointment.controller.js";

import {
  createMedicineRequestController,
  getMyMedicineRequestsController,
} from "./controllers/doctor-medicine-request.controller.js";

const router = Router();

// Public: approved doctors only
router.get("/", doctorController.list);
router.get(
  "/:doctorId/slots",
  asyncHandler(getAvailableSlotsController),
);
router.get("/:doctorId", doctorController.getById);

// Authenticated user: apply and view own application
router.post(
  "/application",
  authenticate,
  authorize(Role.PATIENT),
  doctorController.submitApplication,
);

router.get(
  "/me/profile",
  authenticate,
  authorize(Role.PATIENT, Role.DOCTOR),
  doctorController.getMyProfile,
);

// Doctor slots
router.post(
  "/me/slots",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(createSlotController),
);

router.get(
  "/me/slots",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(getMySlotsController),
);

router.patch(
  "/me/slots/:slotId",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(updateSlotController),
);

// Doctor appointment requests
router.get(
  "/me/appointment-requests",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(getAppointmentRequestsController),
);

router.patch(
  "/me/appointments/:appointmentId/decision",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(decideAppointmentController),
);

router.patch(
  "/me/appointments/:appointmentId/complete",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(completeConsultationController),
);

// Doctor medicine requests
router.post(
  "/me/medicine-requests",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(createMedicineRequestController),
);

router.get(
  "/me/medicine-requests",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(getMyMedicineRequestsController),
);

export default router;
