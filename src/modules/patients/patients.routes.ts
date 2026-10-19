import { Router } from "express";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { patientController } from "./controllers/patient.controller.js";
import { validateUpdatePatientProfile } from "./patients.validation.js";

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
export default patientRouter;
