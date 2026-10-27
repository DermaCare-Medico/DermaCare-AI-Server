
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import {
  uploadPrivateImage,
  deletePrivateImage,
  downloadPrivateImage,
} from "../../../shared/services/cloudinary/cloudinary.service.js";
import type { SaveScreeningImageInput } from "../../../types/screenings.types.js";

interface UploadScreeningImageInput extends SaveScreeningImageInput {
  userId: string;
}

export function assertScreeningAcceptsImage(
  aiStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
): void {
  if (aiStatus === "PENDING" || aiStatus === "FAILED") return;

  throw new AppError(
    aiStatus === "COMPLETED"
      ? "Screening has already been processed"
      : "Screening is already processing",
    409,
  );
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
      select: { id: true, aiStatus: true },
    });

    if (!screening) {
      throw new AppError(
        "Screening not found or access denied",
        404,
      );
    }

    assertScreeningAcceptsImage(screening.aiStatus);

    const uploaded = await uploadPrivateImage(filePath);
    uploadedPublicId = uploaded.public_id;

    const image = await prisma.$transaction(async (tx) => {
      const claimed = await tx.screening.updateMany({
        where: {
          id: screeningId,
          patient: { is: { userId } },
          aiStatus: { in: ["PENDING", "FAILED"] },
        },
        data: { aiStatus: "PROCESSING", completedAt: null },
      });

      if (claimed.count !== 1) {
        throw new AppError("Screening is already processing", 409);
      }

      return tx.screeningImage.create({
        data: {
          screeningId,
          storageKey: uploaded.public_id,
          imageType,
        },
      });
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getAuthorizedScreeningImageData(
  userId: string,
  screeningId: string,
  imageId: string,
) {
  if (!UUID_REGEX.test(userId) || !UUID_REGEX.test(screeningId) || !UUID_REGEX.test(imageId)) {
    throw new AppError("Screening image not found or access denied", 404);
  }

  const image = await prisma.screeningImage.findFirst({
    where: {
      id: imageId,
      screeningId,
      screening: {
        patient: { is: { userId } },
      },
    },
    select: {
      id: true,
      storageKey: true,
      imageType: true,
    },
  });

  if (!image) {
    throw new AppError("Screening image not found or access denied", 404);
  }

  const fileBuffer = await downloadPrivateImage(image.storageKey);

  return {
    image,
    fileBuffer,
  };
}
