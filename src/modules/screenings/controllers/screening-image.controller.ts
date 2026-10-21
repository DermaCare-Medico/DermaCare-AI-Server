
import { unlink } from "node:fs/promises";
import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../shared/errors/AppError.js";
import { saveScreeningImage } from "../services/screening-image.service.js";
import { processScreeningPrediction } from "../services/screening-prediction.service.js";
import { screeningImageSchema } from "../screenings.validation.js";

export async function uploadScreeningImageController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const file = req.file;

  if (!file) {
    return next(new AppError("Screening image is required", 400));
  }

  try {
    if (!req.auth) {
      throw new AppError("Authentication required", 401);
    }

    const validation = screeningImageSchema.safeParse(req.body);

    if (!validation.success) {
      throw new AppError(
        "Invalid screening image input",
        400,
      );
    }

    const { screeningId, imageType } = validation.data;

    const savedImage = await saveScreeningImage({
      screeningId,
      imageType,
      filePath: file.path,
      userId: req.auth.userId,
    });

    const prediction = await processScreeningPrediction({
      screeningId,
      userId: req.auth.userId,
      imagePath: file.path,
    });

    return res.status(201).json({
      success: true,
      message: "Screening image uploaded and analyzed successfully",
      data: {
        image: savedImage,
        ...prediction,
      },
    });
  } catch (error) {
    return next(error);
  } finally {
    await unlink(file.path).catch((cleanupError) => {
      console.error(
        "Temporary image cleanup failed:",
        cleanupError,
      );
    });
  }
}
