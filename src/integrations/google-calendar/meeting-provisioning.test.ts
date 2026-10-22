import assert from "node:assert/strict";
import test from "node:test";

import {
  AppointmentStatus,
  MeetingProvisioningStatus,
  Role,
  TransactionStatus,
  type Prisma,
} from "../../generated/prisma/client.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import { AppError } from "../../shared/errors/AppError.js";
import { canExposeMeeting } from "./meeting-access.rules.js";
import { createGoogleMeet, googleEventIdForAppointment } from "./google-meet.service.js";
import { MAX_MEETING_ATTEMPTS } from "./meeting-provisioning.rules.js";
import {
  resetExhaustedMeetingForRecovery,
  runClaimedMeeting,
} from "./meeting-provisioning.worker.js";

const job = {
  appointmentId: "123e4567-e89b-12d3-a456-426614174000",
  startTime: new Date("2030-01-01T10:00:00.000Z"),
  endTime: new Date("2030-01-01T10:30:00.000Z"),
  attempts: 1,
};

test("successful provisioning persists the Meet result", async () => {
  let completed: unknown;
  await runClaimedMeeting(job, async () => ({ eventId: "event", meetUrl: "https://meet.google.com/abc-defg-hij" }),
    async (result) => { completed = result; }, async () => assert.fail("must not fail"));
  assert.deepEqual(completed, { eventId: "event", meetUrl: "https://meet.google.com/abc-defg-hij" });
});

test("failures are scheduled for an exponential retry", async () => {
  const now = new Date("2030-01-01T00:00:00.000Z");
  let retryAt: Date | null | undefined;
  await runClaimedMeeting(job, async () => { throw new Error("temporary outage"); },
    async () => assert.fail("must not complete"), async (_error, next) => { retryAt = next; }, now);
  assert.equal(retryAt?.toISOString(), "2030-01-01T00:00:05.000Z");
});

test("final failure stops retrying", async () => {
  let retryAt: Date | null | undefined = undefined;
  await runClaimedMeeting({ ...job, attempts: MAX_MEETING_ATTEMPTS }, async () => { throw new Error("outage"); },
    async () => assert.fail("must not complete"), async (_error, next) => { retryAt = next; });
  assert.equal(retryAt, null);
});

test("deterministic event id and conflict lookup prevent duplicate meetings", async () => {
  const eventId = googleEventIdForAppointment(job.appointmentId);
  let insertedId: string | null | undefined;
  const calendar = {
    events: {
      insert: async (request: { requestBody?: { id?: string | null } }) => {
        insertedId = request.requestBody?.id;
        throw { code: 409 };
      },
      get: async (request: { eventId: string }) => ({
        data: { id: request.eventId, hangoutLink: "https://meet.google.com/existing" },
      }),
    },
  };
  const result = await createGoogleMeet(job, calendar as never);
  assert.equal(insertedId, eventId);
  assert.deepEqual(result, { eventId, meetUrl: "https://meet.google.com/existing" });
});

test("meeting access requires both paid and confirmed", () => {
  assert.equal(canExposeMeeting(AppointmentStatus.CONFIRMED, TransactionStatus.PAID), true);
  assert.equal(canExposeMeeting(AppointmentStatus.CONFIRMED, TransactionStatus.PENDING), false);
  assert.equal(canExposeMeeting(AppointmentStatus.PENDING, TransactionStatus.PAID), false);
  assert.equal(canExposeMeeting(AppointmentStatus.COMPLETED, TransactionStatus.PAID), false);
});

type RecoveryState = {
  status: AppointmentStatus;
  videoLink: string | null;
  provisioningStatus: MeetingProvisioningStatus;
  attempts: number;
  nextAttemptAt: Date | null;
  lockedAt: Date | null;
  paid: boolean;
};

const recoveryClient = (state: RecoveryState) => {
  const audits: unknown[] = [];
  const client = {
    appointment: {
      updateMany: async () => {
        const eligible = state.status === AppointmentStatus.CONFIRMED
          && state.videoLink === null
          && state.provisioningStatus === MeetingProvisioningStatus.FAILED
          && state.attempts >= MAX_MEETING_ATTEMPTS
          && state.nextAttemptAt === null
          && state.lockedAt === null
          && state.paid;
        if (!eligible) return { count: 0 };
        state.provisioningStatus = MeetingProvisioningStatus.PENDING;
        state.attempts = 0;
        state.nextAttemptAt = new Date();
        return { count: 1 };
      },
      findUnique: async () => ({ id: job.appointmentId }),
    },
    auditLog: {
      create: async (args: unknown) => {
        audits.push(args);
        return args;
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { client, audits };
};

const exhaustedState = (): RecoveryState => ({
  status: AppointmentStatus.CONFIRMED,
  videoLink: null,
  provisioningStatus: MeetingProvisioningStatus.FAILED,
  attempts: MAX_MEETING_ATTEMPTS,
  nextAttemptAt: null,
  lockedAt: null,
  paid: true,
});

test("Admin recovery atomically resets an exhausted paid appointment", async () => {
  const state = exhaustedState();
  const { client, audits } = recoveryClient(state);
  const result = await resetExhaustedMeetingForRecovery(
    client,
    "00000000-0000-0000-0000-000000000002",
    job.appointmentId,
  );
  assert.equal(result.meetingProvisioningStatus, MeetingProvisioningStatus.PENDING);
  assert.equal(state.attempts, 0);
  assert.equal(audits.length, 1);
});

test("duplicate recovery request cannot reset the same job twice", async () => {
  const state = exhaustedState();
  const { client } = recoveryClient(state);
  await resetExhaustedMeetingForRecovery(client, "admin", job.appointmentId);
  await assert.rejects(
    resetExhaustedMeetingForRecovery(client, "admin", job.appointmentId),
    (error: unknown) => error instanceof AppError && error.statusCode === 409,
  );
});

test("recovery rejects unpaid, unconfirmed, non-exhausted, or completed jobs", async () => {
  const states = [
    { ...exhaustedState(), paid: false },
    { ...exhaustedState(), status: AppointmentStatus.PENDING },
    { ...exhaustedState(), attempts: MAX_MEETING_ATTEMPTS - 1 },
    { ...exhaustedState(), videoLink: "https://meet.google.com/existing" },
  ];
  for (const state of states) {
    await assert.rejects(
      resetExhaustedMeetingForRecovery(recoveryClient(state).client, "admin", job.appointmentId),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );
  }
});

test("non-Admin role is rejected by the recovery route authorization", () => {
  let received: unknown;
  authorize(Role.ADMIN)(
    { auth: { userId: "patient", role: Role.PATIENT } } as never,
    {} as never,
    (error?: unknown) => { received = error; },
  );
  assert.ok(received instanceof AppError);
  assert.equal((received as AppError).statusCode, 403);
});
