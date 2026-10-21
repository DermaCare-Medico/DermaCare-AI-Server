import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";

export async function setDoctorSpecializations(
  doctorId: string,
  specializationIds: string[],
) {
  const uniqueIds = [...new Set(specializationIds)];

  if (uniqueIds.length < 1 || uniqueIds.length > 4) {
    throw new AppError(
      "Select between 1 and 4 specializations",
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    const doctor = await tx.doctorProfile.findUnique({
      where: { id: doctorId },
      select: { id: true },
    });

    if (!doctor) {
      throw new AppError("Doctor profile not found", 404);
    }

    const matches = await tx.specialization.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });

    if (matches.length !== uniqueIds.length) {
      throw new AppError(
        "One or more specializations are invalid",
        400,
      );
    }

    await tx.doctorSpecialization.deleteMany({
      where: { doctorId },
    });

    await tx.doctorSpecialization.createMany({
      data: uniqueIds.map((specializationId) => ({
        doctorId,
        specializationId,
      })),
    });

    return tx.doctorSpecialization.findMany({
      where: { doctorId },
      include: {
        specialization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });
}