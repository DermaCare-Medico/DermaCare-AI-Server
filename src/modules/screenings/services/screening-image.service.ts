
import { unlink } from "node:fs/promises";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import {
  uploadPrivateImage,
  deletePrivateImage,
} from "../../../shared/services/cloudinary/cloudinary.service.js";
import type { SaveScreeningImageInput } from "../../../types/screenings.types.js";

interface UploadScreeningImageInput extends SaveScreeningImageInput {
  userId: string;
}

export async function saveScreeningImage(
  input: UploadScreeningImageInput,
) {
  const { screeningId, filePath, imageType, userId } = input;

  let uploadedPublicId: string | undefined;

  try {
    const screening = await prisma.screening.findFirst({
      where: {
        id: screeningId,
        patient: {
          is: { userId },
        },
      },
      select: { id: true },
    });

    if (!screening) {
      throw new AppError(
        "Screening not found or access denied",
        404,
      );
    }

    const uploaded = await uploadPrivateImage(filePath);
    uploadedPublicId = uploaded.public_id;

    const image = await prisma.screeningImage.create({
      data: {
        screeningId,
        storageKey: uploaded.public_id,
        imageType,
      },
    });

    return image;
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await deletePrivateImage(uploadedPublicId);
      } catch (cleanupError) {
        console.error(
          "Cloudinary cleanup failed:",
          cleanupError,
        );
      }
    }

    throw error;
  } 
}
