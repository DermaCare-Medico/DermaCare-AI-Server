import assert from "node:assert/strict";
import test from "node:test";

import { AppointmentStatus, TransactionStatus } from "../../generated/prisma/client.js";
import { canExposeMeeting } from "./meeting-access.rules.js";
import { createGoogleMeet, googleEventIdForAppointment } from "./google-meet.service.js";
import { MAX_MEETING_ATTEMPTS } from "./meeting-provisioning.rules.js";
import { runClaimedMeeting } from "./meeting-provisioning.worker.js";

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
