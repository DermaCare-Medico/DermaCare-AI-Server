import assert from "node:assert/strict";
import test from "node:test";

import {
  AppointmentStatus,
  MeetingProvisioningStatus,
  Prisma,
  TransactionStatus,
} from "../../../generated/prisma/client.js";
import {
  appointmentListSelect,
  appointmentListPagination,
  patientAppointmentListWhere,
  presentAppointmentList,
} from "./appointment.service.js";

const item = (overrides: Record<string, unknown> = {}) => ({
  id: "appointment-id",
  status: AppointmentStatus.CONFIRMED,
  videoLink: "https://meet.example/appointment",
  meetingProvisioningStatus: MeetingProvisioningStatus.READY,
  createdAt: new Date("2026-10-29T01:00:00.000Z"),
  doctor: {
    id: "doctor-id",
    consultationFee: new Prisma.Decimal("500"),
    user: { name: "Doctor Name" },
    specializations: [{ specialization: { id: "specialization-id", name: "Dermatology" } }],
  },
  slot: {
    id: "slot-id",
    startTime: new Date("2026-10-30T01:00:00.000Z"),
    endTime: new Date("2026-10-30T01:30:00.000Z"),
  },
  prescription: { sentAt: new Date("2026-10-29T02:00:00.000Z") },
  payments: [{ status: TransactionStatus.PAID }],
  ...overrides,
});

test("patient appointment list projection excludes detail-only relations", () => {
  assert.equal("screening" in appointmentListSelect, false);
  assert.equal("historySharingConsent" in appointmentListSelect, false);
  assert.equal("cancellationReason" in appointmentListSelect, false);
  assert.equal("holdExpiresAt" in appointmentListSelect, false);
  assert.equal("updatedAt" in appointmentListSelect, false);
  assert.equal("bio" in appointmentListSelect.doctor.select, false);
  assert.equal("qualifications" in appointmentListSelect.doctor.select, false);
  assert.equal(appointmentListSelect.payments.take, 1);
  assert.equal(appointmentListSelect.payments.orderBy.createdAt, "desc");
});

test("patient appointment list response preserves the established contract", () => {
  const result = presentAppointmentList(item());
  assert.deepEqual(Object.keys(result), [
    "id", "status", "doctor", "slot", "paymentStatus", "prescriptionSent",
    "videoLink", "meetingProvisioningStatus", "createdAt",
  ]);
  assert.deepEqual(Object.keys(result.doctor), [
    "id", "name", "specialization", "specializations", "consultationFee",
  ]);
  assert.equal(result.paymentStatus, TransactionStatus.PAID);
  assert.equal(result.prescriptionSent, true);
  assert.equal(result.videoLink, "https://meet.example/appointment");
});

test("unpaid appointment list items hide meeting data and report null payment", () => {
  const result = presentAppointmentList(item({
    status: AppointmentStatus.PENDING,
    payments: [],
    prescription: null,
  }));
  assert.equal(result.paymentStatus, null);
  assert.equal(result.prescriptionSent, false);
  assert.equal(result.videoLink, null);
  assert.equal(result.meetingProvisioningStatus, "NOT_REQUESTED");
});

test("patient appointment list scopes ownership and optional status", () => {
  assert.deepEqual(patientAppointmentListWhere("patient-a"), { patientId: "patient-a" });
  assert.deepEqual(
    patientAppointmentListWhere("patient-a", AppointmentStatus.CONFIRMED),
    { patientId: "patient-a", status: AppointmentStatus.CONFIRMED },
  );
});

test("patient appointment pagination remains compatible", () => {
  assert.deepEqual(appointmentListPagination(2, 20, 41), {
    page: 2,
    limit: 20,
    total: 41,
    totalPages: 3,
  });
});
