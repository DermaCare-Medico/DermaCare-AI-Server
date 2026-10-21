
import type { Request, Response } from "express";
import { unlink } from "node:fs/promises";
import { AppError } from "../../../shared/errors/AppError.js";
import { screeningImageSchema } from "../screenings.validation.js";
import { saveScreeningImage } from "../services/screening-image.service.js";

export async function uploadScreeningImageController(
  req: Request,
  res: Response,
) {
  const file = req.file;

  if (!file) {
    throw new AppError("Please upload an image", 400);
  }

  const validation = screeningImageSchema.safeParse(req.body);

  if (!validation.success) {
    await unlink(file.path).catch(() => undefined);

    throw new AppError("Invalid screening image input", 400);
  }

  if (!req.auth) {
    await unlink(file.path).catch(() => undefined);

    throw new AppError("Authentication required", 401);
  }

  const image = await saveScreeningImage({
    ...validation.data,
    filePath: file.path,
    userId: req.auth.userId,
  });

  return res.status(201).json({
    success: true,
    message: "Screening image uploaded successfully",
    data: image,
  });
}
