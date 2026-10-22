import assert from "node:assert/strict";
import test from "node:test";

import { Role } from "../../../generated/prisma/client.js";
import { accountRoleForRegistration } from "./auth.helpers.js";

test("doctor registration intent creates an unapproved user account", () => {
  assert.equal(accountRoleForRegistration("DOCTOR"), Role.USER);
});

test("patient registration remains a patient account", () => {
  assert.equal(accountRoleForRegistration("PATIENT"), Role.PATIENT);
});
