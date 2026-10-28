import assert from "node:assert/strict";
import test from "node:test";
import { AppointmentStatus } from "../../generated/prisma/client.js";
import { canCreatePrescription, isPrescriptionMutable } from "./prescription.rules.js";
import { prescriptionItemSchema } from "./prescriptions.validation.js";

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

test("prescription items normalize the documented durationDays field", () => {
  const item = prescriptionItemSchema.parse({
    medicineName: "Hydrocortisone 1% Cream",
    dosage: "Thin layer",
    frequency: "Twice daily",
    durationDays: 7,
  });
  assert.equal(item.duration, "7");
  assert.equal("durationDays" in item, false);
});

test("prescription items still accept the existing duration field", () => {
  const item = prescriptionItemSchema.parse({
    medicineName: "Hydrocortisone 1% Cream",
    dosage: "Thin layer",
    frequency: "Twice daily",
    duration: "7 days",
  });
  assert.equal(item.duration, "7 days");
});
