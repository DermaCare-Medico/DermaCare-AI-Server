
import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NotificationType } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { createNotification, createNotificationIfEligible } from "../../notifications/services/notification.service.js";
import {
  predictSkinImage,
  UnusableScreeningImageError,
} from "../../../shared/services/ai/ai-inference.service.js";
import { downloadPrivateImage } from "../../../shared/services/cloudinary/cloudinary.service.js";
import { MODEL_CONDITION_LABELS } from "../../../shared/constants/screening.constants.js";
import { deriveScreeningSafety } from "./screening-safety.rules.js";

interface ProcessPredictionInput {
  screeningId: string;
  userId: string;
  imagePath: string;
}

export async function processScreeningPrediction(
  input: ProcessPredictionInput,
) {
  const { screeningId, userId, imagePath } = input;

  const screening = await prisma.screening.findFirst({
    where: {
      id: screeningId,
      patient: {
        is: { userId },
      },
    },
    select: {
      id: true,
      aiStatus: true,
      redFlagDetected: true,
    },
  });

  if (!screening) {
    throw new AppError("Screening not found or access denied", 404);
  }

  const claimed = await prisma.screening.updateMany({
    where: {
      id: screeningId,
      patient: { is: { userId } },
      aiStatus: { in: ["PENDING", "FAILED"] },
    },
    data: { aiStatus: "PROCESSING" },
  });
  if (claimed.count !== 1) {
    throw new AppError(
      screening.aiStatus === "COMPLETED"
        ? "Screening has already been processed"
        : "Screening is already processing",
      409,
    );
  }

  try {
    const rawPredictions = await predictSkinImage(imagePath);
    const topFive = rawPredictions.slice(0, 5);

    if (topFive.length === 0) {
      throw new Error("The AI model returned no predictions");
    }

    const allowedLabels = new Set<string>(MODEL_CONDITION_LABELS);

    for (const prediction of topFive) {
      if (!allowedLabels.has(prediction.className)) {
        throw new Error(`Unknown model label: ${prediction.className}`);
      }
    }

    const uniqueLabels = [
      ...new Set(topFive.map((prediction) => prediction.className)),
    ];

    const conditions = await prisma.condition.findMany({
      where: {
        name: { in: uniqueLabels },
      },
      select: {
        id: true,
        name: true,
        riskCategory: true,
      },
    });

    const conditionByName = new Map(
      conditions.map((condition) => [condition.name, condition]),
    );

    const missingLabels = uniqueLabels.filter(
      (label) => !conditionByName.has(label),
    );

    if (missingLabels.length > 0) {
      throw new Error(
        `Missing Condition records: ${missingLabels.join(", ")}`,
      );
    }

    const predictionRows = topFive.map((prediction) => {
      const condition = conditionByName.get(prediction.className);

      if (!condition) {
        throw new Error(
          `Condition mapping failed: ${prediction.className}`,
        );
      }

      return {
        screeningId,
        conditionId: condition.id,
        confidenceScore: Number(
          (prediction.score * 100).toFixed(2),
        ),
      };
    });

    const topPrediction = topFive[0];

    if (!topPrediction) {
      throw new Error("The AI model returned no top prediction");
    }

    const safety = deriveScreeningSafety(
      topFive.map((prediction) => ({
        confidencePercent: Number((prediction.score * 100).toFixed(2)),
        riskCategory: conditionByName.get(prediction.className)!.riskCategory,
      })),
      screening.redFlagDetected,
    );
    const disclaimer = safety.redFlagDetected
      ? "Potential clinical red flags indicated. Prompt medical evaluation by a licensed healthcare professional is strongly advised. AI screening is non-diagnostic."
      : safety.uncertain
        ? "This AI result is low-confidence and non-diagnostic. Consult a qualified doctor for assessment."
        : "AI screening is not a medical diagnosis. Consult a qualified doctor.";

    await prisma.$transaction(async (tx) => {
      // AI-03: Multi-view aggregation: keep highest confidence and aggregate across views
      for (const row of predictionRows) {
        const existing = await tx.screeningPrediction.findFirst({
          where: { screeningId, conditionId: row.conditionId },
        });
        if (existing) {
          if (Number(row.confidenceScore) > Number(existing.confidenceScore)) {
            await tx.screeningPrediction.update({
              where: { id: existing.id },
              data: { confidenceScore: row.confidenceScore },
            });
          }
        } else {
          await tx.screeningPrediction.create({
            data: row,
          });
        }
      }

      await tx.screening.update({
        where: { id: screeningId },
        data: {
          aiStatus: "COMPLETED",
          disclaimer,
          riskLevel: safety.riskLevel,
          redFlagDetected: safety.redFlagDetected,
          imageQualityStatus: "GOOD",
        },
      });

      await createNotification({
        userId,
        title: "AI screening completed",
        message: safety.redFlagDetected
          ? "Your AI skin screening results are ready. Prompt clinical review is advised."
          : "Your AI skin screening results are ready to view.",
        notificationType: NotificationType.SYSTEM,
        relatedEntityType: "Screening",
        relatedEntityId: screeningId,
      }, tx);
    });

    return {
      screeningId,
      aiStatus: "COMPLETED" as const,
      disclaimer,
      safety,
      imageQualityStatus: "GOOD" as const,
      prediction: {
        condition: topPrediction.className,
        confidenceScore: Number(
          (topPrediction.score * 100).toFixed(2),
        ),
      },
    };
  } catch (error) {
    await prisma.screening
      .updateMany({
        where: { id: screeningId, aiStatus: "PROCESSING" },
        data: {
          aiStatus: "FAILED",
          ...(error instanceof UnusableScreeningImageError && {
            imageQualityStatus: "UNUSABLE",
          }),
          disclaimer: "AI screening could not produce a reliable result. Consult a qualified doctor.",
        },
      })
      .catch((statusError) => {
        console.error(
          "Failed to update screening status:",
          statusError,
        );
      });

    await createNotification({
      userId,
      title: "AI screening failed",
      message: "Your AI skin screening could not be processed. Please retry with a clearer photo.",
      notificationType: NotificationType.SYSTEM,
      relatedEntityType: "Screening",
      relatedEntityId: screeningId,
    }).catch(() => {});

    throw error;
  }
}

export async function retryFailedScreening(userId: string, screeningId: string) {
  const screening = await prisma.screening.findFirst({
    where: {
      id: screeningId,
      aiStatus: "FAILED",
      patient: { is: { userId } },
    },
    select: {
      images: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { storageKey: true },
      },
    },
  });
  if (!screening) throw new AppError("Failed screening not found or not retryable", 409);
  const image = screening.images[0];
  if (!image) throw new AppError("No stored image is available for retry", 409);

  const filePath = path.join(os.tmpdir(), `${randomUUID()}.screening-image`);
  try {
    await writeFile(filePath, await downloadPrivateImage(image.storageKey));
    return await processScreeningPrediction({ screeningId, userId, imagePath: filePath });
  } finally {
    await unlink(filePath).catch(() => undefined);
  }
}
