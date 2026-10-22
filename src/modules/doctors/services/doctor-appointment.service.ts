import {
  AppointmentStatus,
  DoctorApprovalStatus,
  NotificationType,
  Prisma,
  SlotStatus,
  TransactionPurpose,
  TransactionStatus,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { createNotificationIfEligible } from "../../notifications/services/notification.service.js";
import { getConsultationCompletionAction } from "./consultation-completion.rules.js";
import type { DoctorAppointmentHistoryQuery } from "../doctors.validation.js";

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
      status: AppointmentStatus.HELD,
      OR: [
        { holdExpiresAt: null },
        { holdExpiresAt: { gt: new Date() } },
      ],
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

export async function getDoctorAppointmentHistory(
  userId: string,
  query: DoctorAppointmentHistoryQuery,
) {
  const doctor = await getApprovedDoctor(userId);
  const where: Prisma.AppointmentWhereInput = {
    doctorId: doctor.id,
    ...(query.status && { status: query.status }),
  };
  const [appointments, total] = await prisma.$transaction([
    prisma.appointment.findMany({
      where,
      select: {
        id: true,
        status: true,
        createdAt: true,
        cancellationReason: true,
        videoLink: true,
        slot: { select: { id: true, startTime: true, endTime: true } },
        patient: { select: { id: true, user: { select: { id: true, name: true } } } },
        payments: {
          where: { purpose: TransactionPurpose.APPOINTMENT },
          select: { id: true, amount: true, currency: true, status: true, refundStatus: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.appointment.count({ where }),
  ]);
  return {
    appointments,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
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
      include: {
        slot: true,
        patient: {
          select: { userId: true },
        },
      },
    });

    if (!appointment) {
      throw new AppError(
        "Appointment not found",
        HTTP_STATUS.NOT_FOUND,
      );
    }

    // Idempotent duplicate check: already in requested state
    if (action === "ACCEPT" && appointment.status === AppointmentStatus.PENDING) {
      return appointment;
    }
    if (action === "REJECT" && appointment.status === AppointmentStatus.CANCELLED) {
      return appointment;
    }

    if (appointment.status !== AppointmentStatus.HELD) {
      throw new AppError(
        "This appointment is not awaiting a decision",
        HTTP_STATUS.CONFLICT,
      );
    }

    // Check if the hold has expired
    if (appointment.holdExpiresAt && appointment.holdExpiresAt <= new Date()) {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancellationReason: "Hold expired",
        },
      });

      await tx.doctorSlot.updateMany({
        where: {
          id: appointment.slotId,
          doctorId: doctor.id,
          status: SlotStatus.HELD,
        },
        data: { status: SlotStatus.AVAILABLE },
      });

      throw new AppError(
        "Appointment hold has expired",
        HTTP_STATUS.CONFLICT,
      );
    }

    if (action === "ACCEPT") {
      const PAYMENT_WINDOW_MS = 15 * 60 * 1000;
      const paymentExpiresAt = new Date(
        Math.min(Date.now() + PAYMENT_WINDOW_MS, appointment.slot.startTime.getTime())
      );

      const updated = await tx.appointment.updateMany({
        where: {
          id: appointment.id,
          doctorId: doctor.id,
          status: AppointmentStatus.HELD,
        },
        data: {
          status: AppointmentStatus.PENDING,
          holdExpiresAt: paymentExpiresAt,
        },
      });

      if (updated.count !== 1) {
        const current = await tx.appointment.findFirst({
          where: { id: appointment.id },
          include: { slot: true },
        });
        if (current?.status === AppointmentStatus.PENDING) {
          return current;
        }
        throw new AppError(
          "This appointment is not awaiting a decision",
          HTTP_STATUS.CONFLICT,
        );
      }

      await createNotificationIfEligible({
        userId: appointment.patient.userId,
        title: "Appointment accepted",
        message: "Your appointment has been accepted by the doctor. Please proceed with payment to confirm.",
        notificationType: NotificationType.APPOINTMENT,
        relatedEntityType: "Appointment",
        relatedEntityId: appointment.id,
      }, tx);

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        include: { slot: true },
      });
    }

    // action === "REJECT"
    const rejectedUpdate = await tx.appointment.updateMany({
      where: {
        id: appointment.id,
        doctorId: doctor.id,
        status: AppointmentStatus.HELD,
      },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancellationReason: reason || "Rejected by doctor",
        holdExpiresAt: null,
      },
    });

    if (rejectedUpdate.count !== 1) {
      const current = await tx.appointment.findFirst({
        where: { id: appointment.id },
        include: { slot: true },
      });
      if (current?.status === AppointmentStatus.CANCELLED) {
        return current;
      }
      throw new AppError(
        "This appointment is not awaiting a decision",
        HTTP_STATUS.CONFLICT,
      );
    }

    await tx.doctorSlot.updateMany({
      where: {
        id: appointment.slotId,
        doctorId: doctor.id,
        status: SlotStatus.HELD,
      },
      data: { status: SlotStatus.AVAILABLE },
    });

    await createNotificationIfEligible({
      userId: appointment.patient.userId,
      title: "Appointment declined",
      message: "Your appointment request was declined by the doctor.",
      notificationType: NotificationType.APPOINTMENT,
      relatedEntityType: "Appointment",
      relatedEntityId: appointment.id,
    }, tx);

    return tx.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      include: { slot: true },
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

export async function completeDoctorConsultation(
  userId: string,
  appointmentId: string,
) {
  const doctor = await getApprovedDoctor(userId);

  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findFirst({
      where: { id: appointmentId, doctorId: doctor.id },
      select: {
        id: true,
        status: true,
        patient: { select: { userId: true } },
        payments: {
          where: {
            purpose: TransactionPurpose.APPOINTMENT,
            status: TransactionStatus.PAID,
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!appointment) {
      throw new AppError("Appointment not found", HTTP_STATUS.NOT_FOUND);
    }
    const action = getConsultationCompletionAction(
      appointment.status,
      appointment.payments.length > 0,
    );
    if (action === "ALREADY_COMPLETED") {
      return appointment;
    }

    const completed = await tx.appointment.updateMany({
      where: {
        id: appointment.id,
        doctorId: doctor.id,
        status: AppointmentStatus.CONFIRMED,
        payments: {
          some: {
            purpose: TransactionPurpose.APPOINTMENT,
            status: TransactionStatus.PAID,
          },
        },
      },
      data: { status: AppointmentStatus.COMPLETED },
    });

    if (completed.count !== 1) {
      const current = await tx.appointment.findFirst({
        where: { id: appointment.id, doctorId: doctor.id },
        select: { id: true, status: true },
      });
      if (current?.status === AppointmentStatus.COMPLETED) return current;
      throw new AppError("Appointment state changed; please retry", HTTP_STATUS.CONFLICT);
    }

    await tx.auditLog.create({
      data: {
        actorUserId: userId,
        action: "APPOINTMENT_COMPLETED",
        entityType: "Appointment",
        entityId: appointment.id,
        before: { status: AppointmentStatus.CONFIRMED },
        after: { status: AppointmentStatus.COMPLETED },
      },
    });

    await createNotificationIfEligible({
      userId: appointment.patient.userId,
      title: "Consultation completed",
      message: "Your consultation has been marked as completed.",
      notificationType: NotificationType.APPOINTMENT,
      relatedEntityType: "Appointment",
      relatedEntityId: appointment.id,
    }, tx);

    return tx.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      select: { id: true, status: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
