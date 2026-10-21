
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import { uploadScreeningImage } from "../../middlewares/upload.middleware.js";
import { uploadScreeningImageController } from "./controllers/screening-image.controller.js";
import {
  getScreeningHistoryController,
  getScreeningHistoryItemController,
} from "./controllers/screening-history.controller.js";
import { Router } from "express";




const router = Router();
router.post(
  "/images",
  uploadScreeningImage,
  uploadScreeningImageController,
);

router.get(
  "/history",
  authenticate,
  authorize("PATIENT"),
  getScreeningHistoryController,
);

router.get(
  "/history/:screeningId",
  authenticate,
  authorize("PATIENT"),
  getScreeningHistoryItemController,
);

router.post(
  "/images",
  authenticate,
  authorize("PATIENT"),
  uploadScreeningImage,
  uploadScreeningImageController,
);