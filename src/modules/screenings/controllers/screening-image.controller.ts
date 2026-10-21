import type { Request, Response } from "express";
import { unlink } from "node:fs/promises";
import { AppError } from "../../../shared/errors/AppError.js";
import { screeningImageSchema } from "../screenings.validation.js";
import { saveScreeningImage } from "../services/screening-image.service.js";
import { processScreeningPrediction } from "../services/screening-prediction.service.js";

export async function uploadScreeningImageController(
  req: Request,
  res: Response,
) {
  const file = req.file;

  if (!file) {
    throw new AppError("Please upload an image", 400);
  }

  try {
    const validation = screeningImageSchema.safeParse(req.body);

    if (!validation.success) {
      throw new AppError("Invalid screening image input", 400);
    }

    if (!req.auth) {
      throw new AppError("Authentication required", 401);
    }

    const image = await saveScreeningImage({
      ...validation.data,
      filePath: file.path,
      userId: req.auth.userId,
    });

    const prediction = await processScreeningPrediction({
      screeningId: validation.data.screeningId,
      userId: req.auth.userId,
      imagePath: file.path,
    });

    return res.status(201).json({
      success: true,
      message: "Image uploaded and screening processed",
      data: {
        image,
        ...prediction,
      },
    });
  } finally {
    await unlink(file.path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") {
        console.error("Temporary image cleanup failed:", error);
      }
    });
  }
}