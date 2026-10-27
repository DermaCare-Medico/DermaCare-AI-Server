import { prisma } from "../../../lib/prisma.js";
import { generatePrivateImageUrl } from "../../../shared/services/cloudinary/cloudinary.service.js";

export async function getScreeningHistory(
  userId: string,
  database: Pick<typeof prisma, "screening"> = prisma,
) {
  const items = await database.screening.findMany({
    where: {
      patient: {
        is: { userId },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      symptoms: true,
      bodyArea: true,
      imageQualityStatus: true,
      riskLevel: true,
      redFlagDetected: true,
      aiStatus: true,
      disclaimer: true,
      createdAt: true,
      completedAt: true,
      predictions: {
        orderBy: { confidenceScore: "desc" },
        take: 1,
        select: {
          confidenceScore: true,
          condition: {
            select: {
              id: true,
              name: true,
              overview: true,
              riskCategory: true,
              warningSigns: true,
            },
          },
        },
      },
      images: {
        select: {
          id: true,
          imageType: true,
          storageKey: true,
          createdAt: true,
        },
      },
    },
  });

  return items.map((item) => ({
    ...item,
    images: item.images.map(({ storageKey, ...img }) => ({
      ...img,
      imageUrl: generatePrivateImageUrl(storageKey),
    })),
  }));
}

export async function getScreeningHistoryItem(
  userId: string,
  screeningId: string,
  database: Pick<typeof prisma, "screening"> = prisma,
) {
  const item = await database.screening.findFirst({
    where: {
      id: screeningId,
      patient: { is: { userId } },
    },
    select: {
      id: true,
      symptoms: true,
      bodyArea: true,
      imageQualityStatus: true,
      riskLevel: true,
      redFlagDetected: true,
      aiStatus: true,
      disclaimer: true,
      createdAt: true,
      completedAt: true,
      predictions: {
        orderBy: { confidenceScore: "desc" },
        select: {
          confidenceScore: true,
          condition: {
            select: {
              id: true,
              name: true,
              overview: true,
              symptoms: true,
              warningSigns: true,
              prevention: true,
              naturalCare: true,
              safeForHomeCare: true,
              riskCategory: true,
            },
          },
        },
      },
      images: {
        select: {
          id: true,
          imageType: true,
          storageKey: true,
          createdAt: true,
        },
      },
    },
  });

  if (!item) return null;

  return {
    ...item,
    images: item.images.map(({ storageKey, ...img }) => ({
      ...img,
      imageUrl: generatePrivateImageUrl(storageKey),
    })),
  };
}
