import { prisma } from "../../../lib/prisma.js";

export async function getScreeningHistory(userId: string) {
  return prisma.screening.findMany({
    where: {
      patient: {
        is: { userId },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      symptoms: true,
      imageQualityStatus: true,
      riskLevel: true,
      redFlagDetected: true,
      aiStatus: true,
      disclaimer: true,
      createdAt: true,
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
          createdAt: true,
        },
      },
    },
  });
}

export async function getScreeningHistoryItem(
  userId: string,
  screeningId: string,
) {
  return prisma.screening.findFirst({
    where: {
      id: screeningId,
      patient: { is: { userId } },
    },
    select: {
      id: true,
      symptoms: true,
      imageQualityStatus: true,
      riskLevel: true,
      redFlagDetected: true,
      aiStatus: true,
      disclaimer: true,
      createdAt: true,
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
          createdAt: true,
        },
      },
    },
  });
}