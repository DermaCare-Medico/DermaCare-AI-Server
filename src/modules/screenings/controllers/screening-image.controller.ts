
import { unlink } from "node:fs/promises";
import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../shared/errors/AppError.js";
import {
  saveScreeningImage,
  getAuthorizedScreeningImageData,
} from "../services/screening-image.service.js";
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
      alreadyClaimed: true,
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

export async function getScreeningImageController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.auth) {
      throw new AppError("Authentication required", 401);
    }

    const { screeningId, imageId } = req.params;

    if (!screeningId || !imageId) {
      throw new AppError("Screening ID and Image ID are required", 400);
    }

    const { fileBuffer } = await getAuthorizedScreeningImageData(
      req.auth.userId,
      screeningId,
      imageId,
    );

    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    });

    return res.status(200).send(fileBuffer);
  } catch (error) {
    return next(error);
  }
}
