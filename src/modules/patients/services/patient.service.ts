
import { prisma } from "../../../lib/prisma.js";

export const getMyProfile = async (userId: string) => {
  const patient = await prisma.patientProfile.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
      dateOfBirth: true,
      gender: true,
      address: true,
      allergies: true,
      existingConditions: true,

      currentMedications: {
        where: {
          isActive: true,
        },
        select: {
          medicineName: true,
          dosage: true,
          frequency: true,
        },
      },
    },
  });

  if (!patient) {
    throw Object.assign(
      new Error("Patient profile not found"),
      {
        statusCode: 404,
      }
    );
  }

  return patient;
};
