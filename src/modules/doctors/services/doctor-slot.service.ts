import { SlotStatus } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";

async function getDoctorProfile(userId: string) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      approvalStatus: true,
      user: {
        select: {
          status: true,
          deletedAt: true,
        },
      },
    },
  });

  if (
    !doctor ||
    doctor.approvalStatus !== "APPROVED" ||
    doctor.user.status !== "ACTIVE" ||
    doctor.user.deletedAt
  ) {
    throw new AppError(
      "Approved active doctor account required",
      HTTP_STATUS.FORBIDDEN,
    );
  }

  return doctor;
}

export async function createDoctorSlot(
  userId: string,
  input: { startTime: Date; endTime: Date },
) {
  const doctor = await getDoctorProfile(userId);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${doctor.id}, 0))`;
    const overlappingSlot = await tx.doctorSlot.findFirst({
      where: {
        doctorId: doctor.id,
        startTime: { lt: input.endTime },
        endTime: { gt: input.startTime },
        status: { not: SlotStatus.UNAVAILABLE },
      },
      select: { id: true },
    });
    if (overlappingSlot) {
      throw new AppError("This time overlaps with an existing slot", HTTP_STATUS.CONFLICT);
    }
    return tx.doctorSlot.create({
      data: { doctorId: doctor.id, startTime: input.startTime, endTime: input.endTime },
    });
  });
}

export async function getAvailableDoctorSlots(doctorId: string) {
  const doctor = await prisma.doctorProfile.findFirst({
    where: {
      id: doctorId,
      approvalStatus: "APPROVED",
      user: { status: "ACTIVE", deletedAt: null },
    },
    select: { id: true },
  });
  if (!doctor) throw new AppError("Doctor not found", HTTP_STATUS.NOT_FOUND);

  return prisma.doctorSlot.findMany({
    where: {
      doctorId,
      status: SlotStatus.AVAILABLE,
      startTime: { gt: new Date() },
    },
    select: { id: true, startTime: true, endTime: true },
    orderBy: { startTime: "asc" },
  });
}

export async function getMyDoctorSlots(userId: string) {
  const doctor = await getDoctorProfile(userId);

  return prisma.doctorSlot.findMany({
    where: { doctorId: doctor.id },
    orderBy: { startTime: "asc" },
  });
}

export async function updateDoctorSlot(
  userId: string,
  slotId: string,
  status: "AVAILABLE" | "UNAVAILABLE",
) {
  const doctor = await getDoctorProfile(userId);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${doctor.id}, 0))`;
    const slot = await tx.doctorSlot.findFirst({
      where: { id: slotId, doctorId: doctor.id },
      select: { id: true },
    });
    if (!slot) throw new AppError("Slot not found", HTTP_STATUS.NOT_FOUND);

    const updated = await tx.doctorSlot.updateMany({
      where: {
        id: slotId,
        doctorId: doctor.id,
        appointments: { none: { status: { not: "CANCELLED" } } },
      },
      data: { status },
    });
    if (updated.count !== 1) {
      throw new AppError("A slot with an appointment cannot be changed", HTTP_STATUS.CONFLICT);
    }
    return tx.doctorSlot.findUniqueOrThrow({ where: { id: slotId } });
  });
}

export async function deleteDoctorSlot(userId: string, slotId: string) {
  const doctor = await getDoctorProfile(userId);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${doctor.id}, 0))`;
    const slot = await tx.doctorSlot.findFirst({
      where: { id: slotId, doctorId: doctor.id },
      select: { id: true },
    });
    if (!slot) throw new AppError("Slot not found", HTTP_STATUS.NOT_FOUND);

    const deleted = await tx.doctorSlot.deleteMany({
      where: {
        id: slotId,
        doctorId: doctor.id,
        appointments: { none: { status: { not: "CANCELLED" } } },
      },
    });
    if (deleted.count !== 1) {
      throw new AppError("A slot with an active appointment cannot be deleted", HTTP_STATUS.CONFLICT);
    }
    return { success: true, message: "Slot deleted successfully" };
  });
}
