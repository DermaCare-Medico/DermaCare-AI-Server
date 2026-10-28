import assert from "node:assert/strict";
import test from "node:test";

import { createDoctorSlotSchema } from "./doctors.validation.js";

test("slot creation accepts timezone-qualified ISO timestamps and preserves the instant", () => {
  const result = createDoctorSlotSchema.parse({
    startTime: "2099-01-01T09:00:00+06:00",
    endTime: "2099-01-01T09:30:00+06:00",
  });

  assert.equal(result.startTime.toISOString(), "2099-01-01T03:00:00.000Z");
  assert.equal(result.endTime.toISOString(), "2099-01-01T03:30:00.000Z");
});

test("slot creation rejects zero and negative duration", () => {
  for (const endTime of [
    "2099-01-01T09:00:00Z",
    "2099-01-01T08:59:59Z",
  ]) {
    const result = createDoctorSlotSchema.safeParse({
      startTime: "2099-01-01T09:00:00Z",
      endTime,
    });
    assert.equal(result.success, false);
  }
});
