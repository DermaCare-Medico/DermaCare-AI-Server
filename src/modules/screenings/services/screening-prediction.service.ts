
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { predictSkinImage } from "../../../shared/services/ai/ai-inference.service.js";
import { MODEL_CONDITION_LABELS } from "../../../shared/constants/screening.constants.js";

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
    },
  });

  if (!screening) {
    throw new AppError("Screening not found or access denied", 404);
  }

  if (screening.aiStatus === "PROCESSING") {
    throw new AppError("Screening is already processing", 409);
  }

  await prisma.screening.update({
    where: { id: screeningId },
    data: { aiStatus: "PROCESSING" },
  });

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

    const disclaimer =
      "AI screening is not a medical diagnosis. Consult a qualified doctor.";

    await prisma.$transaction(async (tx) => {
      await tx.screeningPrediction.deleteMany({
        where: { screeningId },
      });

      await tx.screeningPrediction.createMany({
        data: predictionRows,
      });

      await tx.screening.update({
        where: { id: screeningId },
        data: {
          aiStatus: "COMPLETED",
          disclaimer,
        },
      });
    });

    return {
      screeningId,
      aiStatus: "COMPLETED" as const,
      disclaimer,
      prediction: {
        condition: topPrediction.className,
        confidenceScore: Number(
          (topPrediction.score * 100).toFixed(2),
        ),
      },
    };
  } catch (error) {
    await prisma.screening
      .update({
        where: { id: screeningId },
        data: { aiStatus: "FAILED" },
      })
      .catch((statusError) => {
        console.error(
          "Failed to update screening status:",
          statusError,
        );
      });

    throw error;
  }
}
