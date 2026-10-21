
import type { Request, Response } from "express";
import { saveScreeningImage } from "../services/screening-image.service.js";

export async function uploadScreeningImageController(
  req: Request,
  res: Response,
) {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      message: "Please upload an image",
    });
  }

  const { screeningId, imageType } = req.body;

  if (!screeningId || !imageType) {
    return res.status(400).json({
      success: false,
      message: "screeningId and imageType are required",
    });
  }

  const screeningImage = await saveScreeningImage({
    screeningId,
    filePath: file.path,
    imageType,
  });

  return res.status(201).json({
    success: true,
    message: "Screening image uploaded successfully",
    data: screeningImage,
  });
}
