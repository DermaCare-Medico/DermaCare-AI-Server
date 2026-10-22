import { Router } from "express";
import { Role } from "../../generated/prisma/client.js";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { uploadScreeningImage } from "../../middlewares/upload.middleware.js";
import { doctorController } from "./doctor.controller.js";

import {
  createSlotController,
  deleteSlotController,
  getAvailableSlotsController,
  getMySlotsController,
  updateSlotController,
} from "./controllers/doctor-slot.controller.js";

import {
  completeConsultationController,
  getAppointmentRequestsController,
  getAppointmentHistoryController,
  decideAppointmentController,
} from "./controllers/doctor-appointment.controller.js";

import {
  createMedicineRequestController,
  getMyMedicineRequestsController,
} from "./controllers/doctor-medicine-request.controller.js";

import { doctorEarningsController } from "./controllers/doctor-earnings.controller.js";

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
  "/application/documents",
  authenticate,
  authorize(Role.USER, Role.PATIENT, Role.DOCTOR),
  uploadScreeningImage,
  doctorController.uploadApplicationDocument,
);

router.post(
  "/application",
  authenticate,
  authorize(Role.USER, Role.PATIENT, Role.DOCTOR),
  doctorController.submitApplication,
);

router.get(
  "/me/profile",
  authenticate,
  authorize(Role.USER, Role.PATIENT, Role.DOCTOR),
  doctorController.getMyProfile,
);

router.patch(
  "/me/profile",
  authenticate,
  authorize(Role.DOCTOR),
  doctorController.updateMyProfile,
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

router.delete(
  "/me/slots/:slotId",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(deleteSlotController),
);

// Doctor appointment requests
router.get(
  "/me/appointment-requests",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(getAppointmentRequestsController),
);

router.get(
  "/me/appointments",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(getAppointmentHistoryController),
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

// Doctor earnings & payouts
router.get(
  "/me/earnings/summary",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(doctorEarningsController.getEarningsSummary),
);

router.get(
  "/me/earnings/history",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(doctorEarningsController.getEarningsHistory),
);

router.get(
  "/me/payouts",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(doctorEarningsController.getPayoutHistory),
);

export default router;
