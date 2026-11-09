import assert from "node:assert/strict";
import test from "node:test";
import { doctorPayoutMetadataMatches } from "./stripe-payment.rules.js";

const expected = { payoutId: "payout-1", doctorId: "doctor-1", adminId: "admin-1" };

test("PaymentIntent payout metadata must match Checkout metadata", () => {
  const metadata = { ...expected };
  assert.equal(doctorPayoutMetadataMatches(metadata, expected), true);
  assert.equal(doctorPayoutMetadataMatches({ ...metadata, payoutId: "other" }, expected), false);
  assert.equal(doctorPayoutMetadataMatches({ ...metadata, doctorId: "other" }, expected), false);
  assert.equal(doctorPayoutMetadataMatches({ ...metadata, adminId: "other" }, expected), false);
  assert.equal(doctorPayoutMetadataMatches({ ...metadata, extra: "unexpected" }, expected), true);
  assert.equal(doctorPayoutMetadataMatches(undefined, expected), false);
});
