import assert from "node:assert/strict";
import test from "node:test";
import { deriveScreeningSafety } from "./screening-safety.rules.js";

test("confidence below the documented 60 percent boundary is non-diagnostic", () => {
  const result = deriveScreeningSafety([{ confidencePercent: 59.99, riskCategory: "MEDIUM" }], false);
  assert.equal(result.uncertain, true);
  assert.equal(result.naturalCareSuppressed, true);
  assert.equal(result.requiresClinicalReview, true);
});

test("a high-risk prediction above the documented 20 percent boundary escalates risk", () => {
  const result = deriveScreeningSafety([
    { confidencePercent: 70, riskCategory: "LOW" },
    { confidencePercent: 21, riskCategory: "HIGH" },
  ], false);
  assert.equal(result.riskLevel, "HIGH");
  assert.equal(result.requiresClinicalReview, true);
});

test("red flags override confidence and force critical review", () => {
  const result = deriveScreeningSafety([{ confidencePercent: 95, riskCategory: "LOW" }], true);
  assert.equal(result.riskLevel, "CRITICAL");
  assert.equal(result.naturalCareSuppressed, true);
  assert.equal(result.requiresClinicalReview, true);
});
