import assert from "node:assert/strict";
import test from "node:test";

import { Role } from "../../../generated/prisma/client.js";
import { noShowAuditData } from "./appointment-audit.rules.js";

test("no-show audit records actor, entity and only a safe status transition", () => {
  const audit = noShowAuditData("actor-id", "appointment-id", Role.ADMIN);
  assert.equal(audit.action, "APPOINTMENT_MARKED_NO_SHOW");
  assert.deepEqual(audit.before, { status: "CONFIRMED" });
  assert.deepEqual(audit.after, { status: "NO_SHOW" });
  assert.deepEqual(audit.metadata, { actorRole: Role.ADMIN });
  const serialized = JSON.stringify(audit);
  for (const forbidden of ["reason", "reviewNotes", "medical", "secret", "stripeError"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
