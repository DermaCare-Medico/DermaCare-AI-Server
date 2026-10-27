import assert from "node:assert/strict";
import test from "node:test";

import {
  doctorAppointmentHistoryQuerySchema,
  doctorApplicationSchema,
  doctorProfileUpdateSchema,
} from "./doctors.validation.js";
import {
  assertDoctorApplicationCanBeSubmitted,
  assertDoctorApplicantRole,
  doctorDocumentBelongsToUser,
  selectOwnedDoctorDocument,
} from "./services/doctor-profile.service.js";
import { DoctorApprovalStatus, Role } from "../../generated/prisma/client.js";
import { parseDoctorApplication } from "./controllers/doctor-profile.controller.js";
import { AppError } from "../../shared/errors/AppError.js";

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
  assert.equal(doctorDocumentBelongsToUser(
    "DermaCare-AI/doctor-documents/user-1/../user-2/license-front",
    "user-1",
  ), false);
  assert.equal(doctorApplicationSchema.safeParse({
    licenseNumber: "LIC-123",
    qualifications: ["MBBS"],
    experienceYears: 5,
    consultationFee: 1000,
    specializationIds: ["123e4567-e89b-42d3-a456-426614174000"],
    documentReferences: ["DermaCare-AI/doctor-documents/user-1/../secret"],
  }).success, false);
  assert.equal(selectOwnedDoctorDocument(
    ["DermaCare-AI/doctor-documents/user-1/license-front"], 0, "user-1",
  ), "DermaCare-AI/doctor-documents/user-1/license-front");
  assert.throws(() => selectOwnedDoctorDocument(
    ["DermaCare-AI/doctor-documents/user-2/license-front"], 0, "user-1",
  ));
  assert.throws(() => selectOwnedDoctorDocument([], 0, "user-1"));
});

test("doctor profile updates reject empty or credential fields", () => {
  assert.equal(doctorProfileUpdateSchema.safeParse({}).success, false);
  assert.equal(doctorProfileUpdateSchema.safeParse({ licenseNumber: "replacement" }).success, false);
  assert.equal(doctorProfileUpdateSchema.safeParse({ bio: "Updated profile" }).success, true);
});

test("pending and approved Doctor applications cannot be submitted again", () => {
  assert.doesNotThrow(() => assertDoctorApplicationCanBeSubmitted(null));
  assert.doesNotThrow(() => assertDoctorApplicationCanBeSubmitted(DoctorApprovalStatus.REJECTED));
  assert.throws(
    () => assertDoctorApplicationCanBeSubmitted(DoctorApprovalStatus.PENDING),
    /already pending review/,
  );
  assert.throws(
    () => assertDoctorApplicationCanBeSubmitted(DoctorApprovalStatus.APPROVED),
    /already approved/,
  );
});

test("only USER and PATIENT roles can submit a Doctor application", () => {
  assert.doesNotThrow(() => assertDoctorApplicantRole(Role.USER));
  assert.doesNotThrow(() => assertDoctorApplicantRole(Role.PATIENT));
  assert.throws(() => assertDoctorApplicantRole(Role.DOCTOR), /cannot apply/);
  assert.throws(() => assertDoctorApplicantRole(Role.ADMIN), /cannot apply/);
  assert.throws(() => assertDoctorApplicantRole(Role.STORE_OWNER), /cannot apply/);
});

test("Doctor applications reject duplicate specialization IDs", () => {
  const specializationId = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(doctorApplicationSchema.safeParse({
    licenseNumber: "LIC-123",
    qualifications: ["MBBS"],
    experienceYears: 5,
    consultationFee: 1000,
    specializationIds: [specializationId, specializationId],
    documentReferences: ["DermaCare-AI/doctor-documents/user-1/license-front"],
  }).success, false);
});

test("invalid Doctor application payloads become actionable HTTP 400 errors", () => {
  assert.throws(
    () => parseDoctorApplication({ licenseNumber: "LIC-123" }),
    (error: unknown) => error instanceof AppError
      && error.statusCode === 400
      && error.message.startsWith("Invalid doctor application:"),
  );
});
