
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";

export interface CreateScreeningPayload {
  symptoms: string;
  hasBleeding?: boolean;
  rapidGrowth?: boolean;
  hasFever?: boolean;
  hasUlceration?: boolean;
  severePain?: boolean;
}

export async function createScreening(
  userId: string,
  input: string | CreateScreeningPayload,
) {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!patient) {
    throw new AppError("Patient profile not found", 404);
  }

  const payload: CreateScreeningPayload = typeof input === "string" ? { symptoms: input } : input;
  const redFlagDetected = Boolean(
    payload.hasBleeding ||
    payload.rapidGrowth ||
    payload.hasFever ||
    payload.hasUlceration ||
    payload.severePain
  );

  return prisma.screening.create({
    data: {
      patientId: patient.id,
      symptoms: payload.symptoms.trim(),
      redFlagDetected,
      aiStatus: "PENDING",
      disclaimer: redFlagDetected
        ? "Potential clinical red flags indicated. Prompt medical evaluation by a licensed healthcare professional is strongly advised. AI screening is non-diagnostic."
        : "AI screening is not a medical diagnosis. Consult a qualified doctor.",
    },
    select: {
      id: true,
      symptoms: true,
      redFlagDetected: true,
      aiStatus: true,
      disclaimer: true,
      createdAt: true,
    },
  });
}
