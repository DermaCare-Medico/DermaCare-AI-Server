
import { Router } from "express";
import { uploadScreeningImage } from "../../middlewares/upload.middleware.js";
import { uploadScreeningImageController } from "./controllers/screening-image.controller.js";

const router = Router();
router.post(
  "/images",
  uploadScreeningImage,
  uploadScreeningImageController,
);
