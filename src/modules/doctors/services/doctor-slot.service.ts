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

  const overlappingSlot = await prisma.doctorSlot.findFirst({
    where: {
      doctorId: doctor.id,
      startTime: { lt: input.endTime },
      endTime: { gt: input.startTime },
      status: { not: SlotStatus.UNAVAILABLE },
    },
  });

  if (overlappingSlot) {
    throw new AppError(
      "This time overlaps with an existing slot",
      HTTP_STATUS.CONFLICT,
    );
  }

  return prisma.doctorSlot.create({
    data: {
      doctorId: doctor.id,
      startTime: input.startTime,
      endTime: input.endTime,
    },
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

  const slot = await prisma.doctorSlot.findFirst({
    where: {
      id: slotId,
      doctorId: doctor.id,
    },
    include: {
      appointments: {
        where: {
          status: {
            notIn: ["CANCELLED"],
          },
        },
        select: { id: true },
      },
    },
  });

  if (!slot) {
    throw new AppError("Slot not found", HTTP_STATUS.NOT_FOUND);
  }

  if (slot.appointments.length > 0) {
    throw new AppError(
      "A slot with an appointment cannot be changed",
      HTTP_STATUS.CONFLICT,
    );
  }

  return prisma.doctorSlot.update({
    where: { id: slot.id },
    data: { status },
  });
}