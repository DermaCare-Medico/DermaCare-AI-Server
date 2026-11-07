import assert from "node:assert/strict";
import test from "node:test";

import { AccountStatus, Role } from "../../../generated/prisma/client.js";
import { AppError } from "../../../shared/errors/AppError.js";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env.js";
import {
  isConcurrentRefreshReplay,
  resolveAccessTokenAccount,
  resolveAccessTokenAccountForMe,
  signAccessToken,
  verifyAccessToken,
} from "./token.service.js";

const claims = { userId: "user-id", role: Role.PATIENT };
const account = {
  id: "user-id",
  role: Role.PATIENT,
  status: AccountStatus.ACTIVE,
  deletedAt: null,
};

const expectStatus = (statusCode: number) => (error: unknown) =>
  error instanceof AppError && error.statusCode === statusCode;

test("active account remains authorized", async () => {
  assert.deepEqual(await resolveAccessTokenAccount(claims, async () => account), claims);
});

test("suspended account is forbidden despite a valid token", async () => {
  await assert.rejects(
    resolveAccessTokenAccount(claims, async () => ({ ...account, status: AccountStatus.SUSPENDED })),
    expectStatus(403),
  );
});

test("soft-deleted account is unauthorized despite a valid token", async () => {
  await assert.rejects(
    resolveAccessTokenAccount(claims, async () => ({ ...account, deletedAt: new Date() })),
    expectStatus(401),
  );
});

test("stale token role cannot retain old authorization", async () => {
  const resolved = await resolveAccessTokenAccount(
    { userId: "user-id", role: Role.ADMIN },
    async () => ({ ...account, role: Role.PATIENT }),
  );
  assert.equal(resolved.role, Role.PATIENT);
});

test("pending and rejected accounts are forbidden", async () => {
  for (const status of [AccountStatus.PENDING, AccountStatus.REJECTED]) {
    await assert.rejects(
      resolveAccessTokenAccount(claims, async () => ({ ...account, status })),
      expectStatus(403),
    );
  }
});

test("valid access tokens verify while expired tokens return 401", () => {
  const token = signAccessToken({ id: "user-id", role: Role.PATIENT });
  assert.equal(verifyAccessToken(token).userId, "user-id");

  const expired = jwt.sign({ role: Role.PATIENT }, env.JWT_ACCESS_SECRET, {
    subject: "user-id",
    algorithm: "HS256",
    issuer: "dermacare-api",
    audience: "dermacare-app",
    expiresIn: -1,
  });
  assert.throws(() => verifyAccessToken(expired), expectStatus(401));
});

test("concurrent refresh replay is distinguished from later credential reuse", () => {
  const revokedAt = new Date("2026-10-29T00:00:00.000Z");
  assert.equal(isConcurrentRefreshReplay(revokedAt, new Date("2026-10-29T00:00:09.999Z")), true);
  assert.equal(isConcurrentRefreshReplay(revokedAt, new Date("2026-10-29T00:00:10.001Z")), false);
});

test("auth me reuses a current account snapshot and current database role", async () => {
  const snapshot = {
    ...account,
    name: "Patient Name",
    email: "patient@example.test",
    emailVerified: true,
    authIdentities: [
      { provider: "GOOGLE" as const, updatedAt: new Date("2026-10-28T00:00:00.000Z") },
    ],
    doctorProfile: null,
  };
  const resolved = await resolveAccessTokenAccountForMe(
    { userId: "user-id", role: Role.ADMIN },
    async () => snapshot,
  );
  assert.equal(resolved.role, Role.PATIENT);
  assert.equal(resolved.account, snapshot);
});

test("password-changed access token is rejected even when Google identity is first", async () => {
  const snapshot = {
    ...account,
    name: "Patient Name",
    email: "patient@example.test",
    emailVerified: true,
    authIdentities: [
      { provider: "GOOGLE" as const, updatedAt: new Date("2026-10-20T00:00:00.000Z") },
      { provider: "PASSWORD" as const, updatedAt: new Date("2026-10-29T00:00:10.000Z") },
    ],
    doctorProfile: null,
  };
  await assert.rejects(
    resolveAccessTokenAccountForMe(
      { userId: "user-id", role: Role.PATIENT, iat: new Date("2026-10-29T00:00:00.000Z").getTime() / 1000 },
      async () => snapshot,
    ),
    expectStatus(401),
  );
});
