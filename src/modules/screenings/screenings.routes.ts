
import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import { uploadScreeningImage } from "../../middlewares/upload.middleware.js";
import { asyncHandler } from "../../middlewares/asyncHandler.middleware.js";

import { uploadScreeningImageController } from "./controllers/screening-image.controller.js";
import { createScreeningController } from "./controllers/screening-questionnaire.controller.js";
import {
  getScreeningHistoryController,
  getScreeningHistoryItemController,
} from "./controllers/screening-history.controller.js";
import {
  screeningDoctorRecommendationController,
} from "./controllers/doctor-recommendation.controller.js";
import { processScreeningPredictionController } from "./controllers/screening-prediction.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorize("PATIENT"));

router.post(
  "/",
  asyncHandler(createScreeningController),
);

router.post(
  "/images",
  uploadScreeningImage,
  asyncHandler(uploadScreeningImageController),
);

router.get(
  "/history",
  asyncHandler(getScreeningHistoryController),
);

router.get(
  "/history/:screeningId",
  asyncHandler(getScreeningHistoryItemController),
);

router.post(
  "/:screeningId/retry",
  asyncHandler(processScreeningPredictionController),
);

router.get(
  "/:screeningId/doctors",
  asyncHandler(screeningDoctorRecommendationController),
);

export default router;
