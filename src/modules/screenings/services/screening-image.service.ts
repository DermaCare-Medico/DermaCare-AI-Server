
import { unlink } from "node:fs/promises";
import { prisma } from "../../../lib/prisma.js";
import {
  uploadPrivateImage,
  deletePrivateImage,
} from "../../../shared/services/cloudinary/cloudinary.service.js";
import type { SaveScreeningImageInput } from "../../../types/screenings.types.js";

export async function saveScreeningImage(
  input: SaveScreeningImageInput,
) {
  const { screeningId, filePath, imageType } = input;

  let uploadedPublicId: string | undefined;

  try {
    const screening = await prisma.screening.findUnique({
      where: { id: screeningId },
      select: { id: true },
    });

    if (!screening) {
      throw new Error("Screening not found");
    }

    const uploadedImage = await uploadPrivateImage(filePath);
    uploadedPublicId = uploadedImage.public_id;

    const screeningImage = await prisma.screeningImage.create({
      data: {
        screeningId,
        storageKey: uploadedImage.public_id,
        imageType,
      },
    });

    return screeningImage;
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await deletePrivateImage(uploadedPublicId);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up Cloudinary image:",
          cleanupError,
        );
      }
    }

    throw error;
  } finally {
    try {
      await unlink(filePath);
    } catch (cleanupError) {
      if (
        typeof cleanupError === "object" &&
        cleanupError !== null &&
        "code" in cleanupError &&
        cleanupError.code !== "ENOENT"
      ) {
        console.error("Failed to remove temporary image:", cleanupError);
      }
    }
  }
}
