import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountStatus,
  DoctorApprovalStatus,
  Role,
} from "../../../generated/prisma/client.js";
import {
  assertDoctorAccountEligibleForApproval,
  assertPendingDoctorApproval,
} from "./doctor-verification.service.js";

test("Doctor approval permits only an unreviewed request", () => {
  assert.doesNotThrow(() => assertPendingDoctorApproval(DoctorApprovalStatus.PENDING));
  assert.throws(
    () => assertPendingDoctorApproval(DoctorApprovalStatus.APPROVED),
    (error: { statusCode?: number }) => error.statusCode === 409,
  );
  assert.throws(
    () => assertPendingDoctorApproval(DoctorApprovalStatus.REJECTED),
    (error: { statusCode?: number }) => error.statusCode === 409,
  );
});

test("Doctor approval rejects suspended, rejected, and deleted accounts", () => {
  assert.doesNotThrow(() =>
    assertDoctorAccountEligibleForApproval({ status: AccountStatus.ACTIVE, deletedAt: null }),
  );
  assert.doesNotThrow(() =>
    assertDoctorAccountEligibleForApproval({
      status: AccountStatus.ACTIVE,
      deletedAt: null,
      role: Role.USER,
    }),
  );
  assert.throws(
    () => assertDoctorAccountEligibleForApproval({
      status: AccountStatus.ACTIVE,
      deletedAt: null,
      role: Role.ADMIN,
    }),
    (error: { statusCode?: number }) => error.statusCode === 400,
  );
  assert.doesNotThrow(() =>
    assertDoctorAccountEligibleForApproval({ status: AccountStatus.PENDING, deletedAt: null }),
  );

  for (const account of [
    { status: AccountStatus.SUSPENDED, deletedAt: null },
    { status: AccountStatus.REJECTED, deletedAt: null },
    { status: AccountStatus.ACTIVE, deletedAt: new Date() },
  ]) {
    assert.throws(
      () => assertDoctorAccountEligibleForApproval(account),
      (error: { statusCode?: number }) => error.statusCode === 400,
    );
  }
});
