
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";

export async function createScreening(
  userId: string,
  symptoms: string,
) {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!patient) {
    throw new AppError("Patient profile not found", 404);
  }

  return prisma.screening.create({
    data: {
      patientId: patient.id,
      symptoms: symptoms.trim(),
      aiStatus: "PENDING",
      disclaimer:
        "AI screening is not a medical diagnosis. Consult a qualified doctor.",
    },
    select: {
      id: true,
      symptoms: true,
      aiStatus: true,
      createdAt: true,
    },
  });
}
