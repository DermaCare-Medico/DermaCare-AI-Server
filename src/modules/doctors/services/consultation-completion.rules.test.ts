import assert from "node:assert/strict";
import test from "node:test";
import { AppointmentStatus } from "../../../generated/prisma/client.js";
import { getConsultationCompletionAction } from "./consultation-completion.rules.js";

test("paid confirmed consultation may complete", () => {
  assert.equal(getConsultationCompletionAction(AppointmentStatus.CONFIRMED, true), "COMPLETE");
});

test("duplicate completion is idempotent", () => {
  assert.equal(getConsultationCompletionAction(AppointmentStatus.COMPLETED, true), "ALREADY_COMPLETED");
});

test("unpaid or invalid lifecycle states cannot complete", () => {
  assert.throws(() => getConsultationCompletionAction(AppointmentStatus.CONFIRMED, false));
  assert.throws(() => getConsultationCompletionAction(AppointmentStatus.PENDING, true));
  assert.throws(() => getConsultationCompletionAction(AppointmentStatus.CANCELLED, true));
});
