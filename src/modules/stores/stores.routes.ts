import { Router } from "express";

import { asyncHandler } from "../../middlewares/asyncHandler.middleware.js";
import { medicineController } from "./controllers/medicine.controller.js";
import {
    validatePublicMedicineId,
    validatePublicMedicineList,
} from "./stores.validation.js";

const storeRouter = Router();

storeRouter.get(
    "/",
    validatePublicMedicineList,
    asyncHandler(medicineController.listPublicMedicines),
);
storeRouter.get(
    "/:id",
    validatePublicMedicineId,
    asyncHandler(medicineController.getPublicMedicine),
);

export default storeRouter;
