import { Router } from "express";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { medicationController } from "./controllers/medication.controller.js";
import { patientController } from "./controllers/patient.controller.js";
import {
    validateCreateMedication,
    validateUpdateMedication,
    validateUpdatePatientProfile,
} from "./patients.validation.js";

const patientRouter = Router();

// Mount this router at the API root after the application's JWT middleware.
patientRouter.get(
    "/patients/me/profile",
    asyncHandler(patientController.getMyProfileController),
);
patientRouter.patch(
    "/patients/me/profile",
    validateUpdatePatientProfile,
    asyncHandler(patientController.updateMyProfileController),
);
patientRouter.get(
    "/patients/me/dashboard",
    asyncHandler(patientController.getMyDashboardController),
);
patientRouter.post(
    "/patients/me/medications",
    validateCreateMedication,
    asyncHandler(medicationController.createMyMedicationController),
);
patientRouter.patch(
    "/patients/me/medications/:id",
    validateUpdateMedication,
    asyncHandler(medicationController.updateMyMedicationController),
);
export default patientRouter;
