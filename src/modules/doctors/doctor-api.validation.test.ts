import assert from "node:assert/strict";
import test from "node:test";

import {
  doctorAppointmentHistoryQuerySchema,
  doctorApplicationSchema,
  doctorProfileUpdateSchema,
} from "./doctors.validation.js";
import { doctorDocumentBelongsToUser } from "./services/doctor-profile.service.js";

test("doctor history pagination is bounded and status is validated", () => {
  assert.deepEqual(doctorAppointmentHistoryQuerySchema.parse({}), { page: 1, limit: 10 });
  assert.equal(doctorAppointmentHistoryQuerySchema.safeParse({ limit: 51 }).success, false);
  assert.equal(doctorAppointmentHistoryQuerySchema.safeParse({ status: "UNKNOWN" }).success, false);
});

test("Doctor applications require authenticated-storage document keys", () => {
  const base = {
    licenseNumber: "LIC-123",
    qualifications: ["MBBS"],
    experienceYears: 5,
    consultationFee: 1000,
    specializationIds: ["123e4567-e89b-42d3-a456-426614174000"],
  };
  assert.equal(doctorApplicationSchema.safeParse(base).success, false);
  assert.equal(doctorApplicationSchema.safeParse({
    ...base,
    documentReferences: ["DermaCare-AI/doctor-documents/user-1/license-front"],
  }).success, true);
  assert.equal(doctorApplicationSchema.safeParse({
    ...base,
    documentReferences: ["https://public.example/license.jpg"],
  }).success, false);
});

test("Doctor document references are bound to their authenticated owner", () => {
  assert.equal(doctorDocumentBelongsToUser(
    "DermaCare-AI/doctor-documents/user-1/license-front",
    "user-1",
  ), true);
  assert.equal(doctorDocumentBelongsToUser(
    "DermaCare-AI/doctor-documents/user-2/license-front",
    "user-1",
  ), false);
});

test("doctor profile updates reject empty or credential fields", () => {
  assert.equal(doctorProfileUpdateSchema.safeParse({}).success, false);
  assert.equal(doctorProfileUpdateSchema.safeParse({ licenseNumber: "replacement" }).success, false);
  assert.equal(doctorProfileUpdateSchema.safeParse({ bio: "Updated profile" }).success, true);
});
