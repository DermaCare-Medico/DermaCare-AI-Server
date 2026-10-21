
import { Router } from "express";
import { Role } from "../../generated/prisma/client.js";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import { doctorController } from "./doctor.controller.js";

const router = Router();

// Public: approved doctors only
router.get("/", doctorController.list);
router.get("/:doctorId", doctorController.getById);

// Authenticated user: apply and view own application
router.post(
  "/application",
  authenticate,
  doctorController.submitApplication,
);

router.get(
  "/me/profile",
  authenticate,
  doctorController.getMyProfile,
);

// Admin-only application review
router.get(
  "/admin/applications/pending",
  authenticate,
  authorize(Role.ADMIN),
  doctorController.getPendingApplications,
);

router.patch(
  "/admin/applications/:applicationId/approve",
  authenticate,
  authorize(Role.ADMIN),
  doctorController.approve,
);

router.patch(
  "/admin/applications/:applicationId/reject",
  authenticate,
  authorize(Role.ADMIN),
  doctorController.reject,
);

export default router;
