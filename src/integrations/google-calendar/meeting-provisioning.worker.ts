import {
  AppointmentStatus,
  MeetingProvisioningStatus,
  Prisma,
  TransactionPurpose,
  TransactionStatus,
} from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { requireActiveAdmin } from "../../modules/admin/services/admin.service.js";
import { AppError } from "../../shared/errors/AppError.js";
import { logger } from "../../shared/logger/logger.js";
import { createGoogleMeet, type MeetingInput, type MeetingResult } from "./google-meet.service.js";
import { MAX_MEETING_ATTEMPTS, meetingRetryDelayMs, safeProvisioningError } from "./meeting-provisioning.rules.js";

const POLL_INTERVAL_MS = 30_000;
const STALE_LOCK_MS = 5 * 60_000;
let running = false;

export type ClaimedMeeting = MeetingInput & { attempts: number };

export const runClaimedMeeting = async (
  job: ClaimedMeeting,
  provision: (input: MeetingInput) => Promise<MeetingResult>,
  complete: (result: MeetingResult) => Promise<void>,
  fail: (error: string, retryAt: Date | null) => Promise<void>,
  now = new Date(),
) => {
  try {
    await complete(await provision(job));
  } catch (error) {
    const retryAt = job.attempts < MAX_MEETING_ATTEMPTS
      ? new Date(now.getTime() + meetingRetryDelayMs(job.attempts))
      : null;
    await fail(safeProvisioningError(error), retryAt);
  }
};

const claimNextMeeting = async (): Promise<ClaimedMeeting | null> => {
  const now = new Date();
  const candidate = await prisma.appointment.findFirst({
    where: {
      status: AppointmentStatus.CONFIRMED,
      videoLink: null,
      meetingProvisioningAttempts: { lt: MAX_MEETING_ATTEMPTS },
      OR: [
        {
          meetingProvisioningStatus: { in: [MeetingProvisioningStatus.PENDING, MeetingProvisioningStatus.FAILED] },
          meetingProvisioningNextAttemptAt: { lte: now },
        },
        {
          meetingProvisioningStatus: MeetingProvisioningStatus.PROCESSING,
          meetingProvisioningLockedAt: { lt: new Date(now.getTime() - STALE_LOCK_MS) },
        },
      ],
    },
    orderBy: { meetingProvisioningNextAttemptAt: "asc" },
    select: {
      id: true,
      meetingProvisioningStatus: true,
      meetingProvisioningLockedAt: true,
      slot: { select: { startTime: true, endTime: true } },
      patient: { select: { user: { select: { email: true } } } },
      doctor: { select: { user: { select: { email: true } } } },
    },
  });
  if (!candidate) return null;

  const claimed = await prisma.appointment.updateMany({
    where: {
      id: candidate.id,
      meetingProvisioningStatus: candidate.meetingProvisioningStatus,
      meetingProvisioningLockedAt: candidate.meetingProvisioningLockedAt,
      videoLink: null,
    },
    data: {
      meetingProvisioningStatus: MeetingProvisioningStatus.PROCESSING,
      meetingProvisioningLockedAt: now,
      meetingProvisioningAttempts: { increment: 1 },
    },
  });
  if (claimed.count !== 1) return null;
  const row = await prisma.appointment.findUniqueOrThrow({
    where: { id: candidate.id },
    select: { meetingProvisioningAttempts: true },
  });
  return {
    appointmentId: candidate.id,
    startTime: candidate.slot.startTime,
    endTime: candidate.slot.endTime,
    patientEmail: candidate.patient.user.email,
    doctorEmail: candidate.doctor.user.email,
    attempts: row.meetingProvisioningAttempts,
  };
};

export const processMeetingProvisioning = async () => {
  if (running) return;
  running = true;
  try {
    for (let job = await claimNextMeeting(); job; job = await claimNextMeeting()) {
      await runClaimedMeeting(
        job,
        createGoogleMeet,
        async ({ eventId, meetUrl }) => {
          await prisma.appointment.update({
            where: { id: job!.appointmentId },
            data: {
              googleCalendarEventId: eventId,
              videoLink: meetUrl,
              meetingProvisioningStatus: MeetingProvisioningStatus.READY,
              meetingProvisioningLockedAt: null,
              meetingProvisioningNextAttemptAt: null,
              meetingProvisioningError: null,
            },
          });
        },
        async (error, retryAt) => {
          await prisma.appointment.update({
            where: { id: job!.appointmentId },
            data: {
              meetingProvisioningStatus: MeetingProvisioningStatus.FAILED,
              meetingProvisioningLockedAt: null,
              meetingProvisioningNextAttemptAt: retryAt,
              meetingProvisioningError: error,
            },
          });
          logger.warn({ appointmentId: job!.appointmentId, retryAt }, "Meet provisioning failed");
        },
      );
    }
  } catch (error) {
    logger.error({ err: error }, "Meet provisioning worker failed");
  } finally {
    running = false;
  }
};

export const requestMeetingProvisioning = () => queueMicrotask(() => void processMeetingProvisioning());

export const resetExhaustedMeetingForRecovery = async (
  tx: Prisma.TransactionClient,
  adminUserId: string,
  appointmentId: string,
  now = new Date(),
) => {
  const reset = await tx.appointment.updateMany({
    where: {
      id: appointmentId,
      status: AppointmentStatus.CONFIRMED,
      videoLink: null,
      meetingProvisioningStatus: MeetingProvisioningStatus.FAILED,
      meetingProvisioningAttempts: { gte: MAX_MEETING_ATTEMPTS },
      meetingProvisioningNextAttemptAt: null,
      meetingProvisioningLockedAt: null,
      payments: {
        some: {
          purpose: TransactionPurpose.APPOINTMENT,
          status: TransactionStatus.PAID,
        },
      },
    },
    data: {
      meetingProvisioningStatus: MeetingProvisioningStatus.PENDING,
      meetingProvisioningAttempts: 0,
      meetingProvisioningNextAttemptAt: now,
      meetingProvisioningLockedAt: null,
      meetingProvisioningError: null,
    },
  });

  if (reset.count !== 1) {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true },
    });
    if (!appointment) throw new AppError("Appointment not found", 404);
    throw new AppError("Appointment is not eligible for Meet recovery", 409);
  }

  await tx.auditLog.create({
    data: {
      actorUserId: adminUserId,
      action: "ADMIN_MEETING_PROVISIONING_RECOVERED",
      entityType: "Appointment",
      entityId: appointmentId,
      metadata: { recoveredAt: now.toISOString() },
    },
  });

  return {
    appointmentId,
    meetingProvisioningStatus: MeetingProvisioningStatus.PENDING,
  };
};

export const recoverMeetingProvisioning = async (
  adminUserId: string,
  appointmentId: string,
) => {
  await requireActiveAdmin(adminUserId);
  const result = await prisma.$transaction((tx) =>
    resetExhaustedMeetingForRecovery(tx, adminUserId, appointmentId));
  requestMeetingProvisioning();
  return result;
};

export const startMeetingProvisioningWorker = () => {
  requestMeetingProvisioning();
  const timer = setInterval(() => void processMeetingProvisioning(), POLL_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
};
