import assert from "node:assert/strict";
import test from "node:test";
import { AppointmentStatus } from "../../generated/prisma/client.js";
import { canCreatePrescription, isPrescriptionMutable } from "./prescription.rules.js";

test("prescriptions can only be created after consultation completion", () => {
  assert.equal(canCreatePrescription(AppointmentStatus.COMPLETED), true);
  for (const status of Object.values(AppointmentStatus).filter((value) => value !== AppointmentStatus.COMPLETED)) {
    assert.equal(canCreatePrescription(status), false);
  }
});

test("only unsent prescriptions remain mutable", () => {
  assert.equal(isPrescriptionMutable(null), true);
  assert.equal(isPrescriptionMutable(new Date()), false);
});
