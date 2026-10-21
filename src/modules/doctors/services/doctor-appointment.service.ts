import {
  AppointmentStatus,
  DoctorApprovalStatus,
  SlotStatus,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";

async function getApprovedDoctor(userId: string) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      approvalStatus: true,
      user: { select: { status: true, deletedAt: true } },
    },
  });

  if (
    !doctor ||
    doctor.approvalStatus !== DoctorApprovalStatus.APPROVED ||
    doctor.user.status !== "ACTIVE" ||
    doctor.user.deletedAt
  ) {
    throw new AppError("Approved doctor required", HTTP_STATUS.FORBIDDEN);
  }

  return doctor;
}

export async function getDoctorAppointmentRequests(userId: string) {
  const doctor = await getApprovedDoctor(userId);

  return prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      status: AppointmentStatus.PENDING,
    },
    include: {
      slot: true,
      patient: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      screening: {
        select: {
          id: true,
          symptoms: true,
          riskLevel: true,
          redFlagDetected: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function decideDoctorAppointment(
  userId: string,
  appointmentId: string,
  action: "ACCEPT" | "REJECT",
  reason?: string,
) {
  const doctor = await getApprovedDoctor(userId);

  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findFirst({
      where: {
        id: appointmentId,
        doctorId: doctor.id,
      },
      include: { slot: true },
    });

    if (!appointment) {
      throw new AppError(
        "Appointment not found",
        HTTP_STATUS.NOT_FOUND,
      );
    }

    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new AppError(
        "This appointment is not awaiting a decision",
        HTTP_STATUS.CONFLICT,
      );
    }

    if (action === "ACCEPT") {
      const slotUpdate = await tx.doctorSlot.updateMany({
        where: {
          id: appointment.slotId,
          doctorId: doctor.id,
          status: SlotStatus.HELD,
        },
        data: { status: SlotStatus.BOOKED },
      });

      if (slotUpdate.count !== 1) {
        throw new AppError(
          "The appointment slot is no longer available",
          HTTP_STATUS.CONFLICT,
        );
      }

      return tx.appointment.update({
        where: { id: appointment.id },
        data: { status: AppointmentStatus.CONFIRMED },
        include: { slot: true },
      });
    }

    const rejected = await tx.appointment.update({
      where: { id: appointment.id },
      data: { status: AppointmentStatus.CANCELLED },
      include: { slot: true },
    });

    await tx.doctorSlot.updateMany({
      where: {
        id: appointment.slotId,
        doctorId: doctor.id,
        status: SlotStatus.HELD,
      },
      data: { status: SlotStatus.AVAILABLE },
    });

    // Keep `reason` for your API/audit layer if a rejection reason
    // field is added to Appointment. No refund/payment logic here.
    void reason;

    return rejected;
  });
}