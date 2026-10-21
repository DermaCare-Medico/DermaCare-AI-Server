import assert from "node:assert/strict";
import test from "node:test";

import { AccountStatus, Role } from "../../../generated/prisma/client.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { resolveAccessTokenAccount } from "./token.service.js";

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
