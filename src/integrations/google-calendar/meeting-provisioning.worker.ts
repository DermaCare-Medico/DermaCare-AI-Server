import { AppointmentStatus, MeetingProvisioningStatus } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
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
    select: { id: true, meetingProvisioningStatus: true, meetingProvisioningLockedAt: true, slot: { select: { startTime: true, endTime: true } } },
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

export const startMeetingProvisioningWorker = () => {
  requestMeetingProvisioning();
  const timer = setInterval(() => void processMeetingProvisioning(), POLL_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
};
