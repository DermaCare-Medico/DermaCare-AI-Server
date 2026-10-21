import { Router } from "express";

import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { prescriptionController } from "./controllers/prescription.controller.js";
import {
    validatePrescriptionId,
    validatePrescriptionList,
} from "./doctors.validation.js";

const doctorRouter = Router();

doctorRouter.get(
    "/patients/me/prescriptions",
    validatePrescriptionList,
    asyncHandler(prescriptionController.listMyPrescriptionsController),
);

doctorRouter.get(
    "/patients/me/prescriptions/:id",
    validatePrescriptionId,
    asyncHandler(prescriptionController.getMyPrescriptionByIdController),
);

export default doctorRouter;
