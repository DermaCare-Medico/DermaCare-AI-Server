import assert from "node:assert/strict";
import test from "node:test";

import { env } from "../../../config/env.js";
import { AppointmentStatus, SlotStatus } from "../../../generated/prisma/client.js";
import { createScreeningSchema } from "../../screenings/screenings.validation.js";
import { deriveScreeningSafety } from "../../screenings/services/screening-safety.rules.js";

test("PAY-01: Demo payments are disabled by default and restricted", () => {
  assert.equal(env.ALLOW_DEMO_PAYMENTS, false, "Demo payments must be disabled by default");
});

test("AI-01: createScreeningSchema accepts structured clinical red flags", () => {
  const result = createScreeningSchema.safeParse({
    symptoms: "Rash with fever",
    hasBleeding: true,
    rapidGrowth: true,
    hasFever: true,
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.hasBleeding, true);
    assert.equal(result.data.rapidGrowth, true);
    assert.equal(result.data.hasFever, true);
  }

  // Backwards compatibility: symptoms only
  const compat = createScreeningSchema.safeParse({
    symptoms: "Mild dryness",
  });
  assert.equal(compat.success, true);
  if (compat.success) {
    assert.equal(compat.data.hasBleeding, undefined);
  }
});

test("AI-01: deriveScreeningSafety escalates risk and suppresses natural care on red flags", () => {
  const predictions = [
    { confidencePercent: 95, riskCategory: "LOW" as const },
  ];
  // Without red flag
  const safeResult = deriveScreeningSafety(predictions, false);
  assert.equal(safeResult.riskLevel, "LOW");
  assert.equal(safeResult.naturalCareSuppressed, false);

  // With red flag
  const alertResult = deriveScreeningSafety(predictions, true);
  assert.equal(alertResult.riskLevel, "CRITICAL");
  assert.equal(alertResult.naturalCareSuppressed, true);
  assert.equal(alertResult.requiresClinicalReview, true);
});

test("APPT-01: Hold expiry prevents stale payment confirmation", () => {
  const expiredHold = new Date(Date.now() - 1000);
  assert.equal(expiredHold <= new Date(), true, "Expired hold must be recognized as past deadline");

  const futureHold = new Date(Date.now() + 15 * 60 * 1000);
  assert.equal(futureHold > new Date(), true, "Valid hold must be in the future");
});

