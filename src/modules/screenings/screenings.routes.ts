
import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import { uploadScreeningImage } from "../../middlewares/upload.middleware.js";

import { uploadScreeningImageController } from "./controllers/screening-image.controller.js";
import {
  getScreeningHistoryController,
  getScreeningHistoryItemController,
} from "./controllers/screening-history.controller.js";
import {
  getScreeningDoctorRecommendationsController,
} from "./controllers/doctor-recommendation.controller.js";



const router = Router();

router.use(authenticate);
router.use(authorize("PATIENT"));

router.post(
  "/images",
  uploadScreeningImage,
  uploadScreeningImageController,
);

router.get(
  "/history",
  getScreeningHistoryController,
);

router.get(
  "/history/:screeningId",
  getScreeningHistoryItemController,
);

router.get(
  "/:screeningId/doctors",
  authenticate,
  authorize("PATIENT"),
  getScreeningDoctorRecommendationsController,
);

export default router;
