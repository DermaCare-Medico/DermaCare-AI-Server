import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountStatus,
  AuthProvider,
  DoctorApprovalStatus,
  Role,
} from "../../../generated/prisma/client.js";
import { accountService } from "./account.service.js";

const snapshot = {
  id: "user-id",
  name: "Patient Name",
  email: "patient@example.test",
  role: Role.PATIENT,
  status: AccountStatus.ACTIVE,
  emailVerified: true,
  deletedAt: null,
  authIdentities: [
    { provider: AuthProvider.PASSWORD, updatedAt: new Date() },
    { provider: AuthProvider.GOOGLE, updatedAt: new Date() },
  ],
  doctorProfile: { approvalStatus: DoctorApprovalStatus.PENDING },
};

test("auth me response remains compatible while using the authenticated snapshot", () => {
  assert.deepEqual(accountService.me(snapshot), {
    user: {
      id: "user-id",
      name: "Patient Name",
      email: "patient@example.test",
      role: Role.PATIENT,
      status: AccountStatus.ACTIVE,
      emailVerified: true,
    },
    doctorStatus: DoctorApprovalStatus.PENDING,
    signInMethods: [AuthProvider.PASSWORD, AuthProvider.GOOGLE],
  });
});

test("doctor without a profile keeps the NO_PROFILE status", () => {
  assert.equal(accountService.me({
    ...snapshot,
    role: Role.DOCTOR,
    doctorProfile: null,
  }).doctorStatus, "NO_PROFILE");
});
