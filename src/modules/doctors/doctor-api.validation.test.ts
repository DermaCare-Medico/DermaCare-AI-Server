import assert from "node:assert/strict";
import test from "node:test";

import {
  doctorAppointmentHistoryQuerySchema,
  doctorProfileUpdateSchema,
} from "./doctors.validation.js";

test("doctor history pagination is bounded and status is validated", () => {
  assert.deepEqual(doctorAppointmentHistoryQuerySchema.parse({}), { page: 1, limit: 10 });
  assert.equal(doctorAppointmentHistoryQuerySchema.safeParse({ limit: 51 }).success, false);
  assert.equal(doctorAppointmentHistoryQuerySchema.safeParse({ status: "UNKNOWN" }).success, false);
});

test("doctor profile updates reject empty or credential fields", () => {
  assert.equal(doctorProfileUpdateSchema.safeParse({}).success, false);
  assert.equal(doctorProfileUpdateSchema.safeParse({ licenseNumber: "replacement" }).success, false);
  assert.equal(doctorProfileUpdateSchema.safeParse({ bio: "Updated profile" }).success, true);
});
