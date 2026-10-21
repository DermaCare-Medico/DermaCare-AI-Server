
import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import { uploadScreeningImage } from "../../middlewares/upload.middleware.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";

import { uploadScreeningImageController } from "./controllers/screening-image.controller.js";
import {
  getScreeningHistoryController,
  getScreeningHistoryItemController,
} from "./controllers/screening-history.controller.js";
import {
  screeningDoctorRecommendationController,
} from "./controllers/doctor-recommendation.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorize("PATIENT"));

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

router.get(
  "/:screeningId/doctors",
  asyncHandler(screeningDoctorRecommendationController),
);

export default router;
