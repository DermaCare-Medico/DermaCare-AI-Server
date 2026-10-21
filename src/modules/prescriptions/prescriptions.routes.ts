import { Router } from "express";
import { Role } from "../../generated/prisma/client.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { prescriptionController } from "./prescriptions.controller.js";

const router = Router();

router.post("/appointments/:id/prescriptions", authorize(Role.DOCTOR), asyncHandler(prescriptionController.create));
router.patch("/prescriptions/:id", authorize(Role.DOCTOR), asyncHandler(prescriptionController.update));
router.put("/prescriptions/:id/items", authorize(Role.DOCTOR), asyncHandler(prescriptionController.replaceItems));
router.post("/prescriptions/:id/finalize", authorize(Role.DOCTOR), asyncHandler(prescriptionController.send));
router.post("/prescriptions/:id/send", authorize(Role.DOCTOR), asyncHandler(prescriptionController.send));
router.get("/patients/me/prescriptions", authorize(Role.PATIENT), asyncHandler(prescriptionController.listMine));
router.get("/patients/me/prescriptions/:id", authorize(Role.PATIENT), asyncHandler(prescriptionController.getMine));

export default router;
