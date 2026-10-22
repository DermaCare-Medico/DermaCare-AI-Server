import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "../../../generated/prisma/client.js";
import {
  buildCheckoutRedirects,
  doctorPayoutCheckoutIdempotencyKey,
  stripeDoctorPayoutMatches,
} from "./stripe-payment.rules.js";

const payout = { id: "payout-1", doctorId: "doctor-1", amount: new Prisma.Decimal("255.50"), sessionId: "cs_1" };
const checkout = {
  id: "cs_1", clientReferenceId: "payout-1", context: "doctorPayout",
  payoutId: "payout-1", doctorId: "doctor-1", amountTotal: 25550, currency: "bdt",
};

test("doctor payout checkout redirects include payout and Stripe session verification data", () => {
  const urls = buildCheckoutRedirects("https://client.example", "doctorPayout", payout.id);
  assert.match(urls.successUrl, /session_id=%7BCHECKOUT_SESSION_ID%7D/);
  assert.match(urls.successUrl, /doctorPayoutId=payout-1/);
  assert.match(urls.cancelUrl, /session_id=%7BCHECKOUT_SESSION_ID%7D/);
  assert.match(urls.cancelUrl, /doctorPayoutId=payout-1/);
});

test("duplicate checkout calls share an idempotency key while an expired retry gets a new key", () => {
  assert.equal(doctorPayoutCheckoutIdempotencyKey(payout.id), doctorPayoutCheckoutIdempotencyKey(payout.id));
  assert.notEqual(doctorPayoutCheckoutIdempotencyKey(payout.id), doctorPayoutCheckoutIdempotencyKey(payout.id, "cs_expired"));
});

test("signed payout completion requires exact ownership, session, amount and currency", () => {
  assert.equal(stripeDoctorPayoutMatches(payout, checkout), true);
  assert.equal(stripeDoctorPayoutMatches(payout, { ...checkout, amountTotal: 25549 }), false);
  assert.equal(stripeDoctorPayoutMatches(payout, { ...checkout, doctorId: "other" }), false);
  assert.equal(stripeDoctorPayoutMatches(payout, { ...checkout, id: "replayed-session" }), false);
  assert.equal(stripeDoctorPayoutMatches(payout, { ...checkout, currency: "usd" }), false);
});
