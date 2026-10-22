import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "../../../generated/prisma/client.js";
import { isRetryablePayoutGenerationConflict } from "./doctor-payout-admin.service.js";

test("monthly payout generation retries unique and serialization races only", () => {
  const conflict = (code: string) => new Prisma.PrismaClientKnownRequestError("conflict", {
    code,
    clientVersion: "test",
  });
  assert.equal(isRetryablePayoutGenerationConflict(conflict("P2002")), true);
  assert.equal(isRetryablePayoutGenerationConflict(conflict("P2034")), true);
  assert.equal(isRetryablePayoutGenerationConflict(conflict("P2025")), false);
  assert.equal(isRetryablePayoutGenerationConflict(new Error("conflict")), false);
});
