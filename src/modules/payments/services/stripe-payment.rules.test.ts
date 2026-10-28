import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "../../../generated/prisma/client.js";
import {
  buildCheckoutRedirects,
  paymentCompletedBeforeDeadline,
  stripePaymentMatches,
  toStripeMinorUnits,
} from "./stripe-payment.rules.js";

test("appointment checkout redirects carry session and appointment context", () => {
  const redirects = buildCheckoutRedirects("https://client.example", "appointment", "appointment-id");
  const success = new URL(redirects.successUrl);
  const cancel = new URL(redirects.cancelUrl);
  assert.equal(success.searchParams.get("session_id"), "{CHECKOUT_SESSION_ID}");
  assert.equal(success.searchParams.get("context"), "appointment");
  assert.equal(success.searchParams.get("appointmentId"), "appointment-id");
  assert.equal(cancel.searchParams.get("context"), "appointment");
  assert.match(redirects.successUrl, /session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.doesNotMatch(redirects.successUrl, /%7BCHECKOUT_SESSION_ID%7D/i);
});

test("order checkout redirects carry session and order context", () => {
  const redirects = buildCheckoutRedirects("https://client.example/app", "order", "order-id");
  const success = new URL(redirects.successUrl);
  const cancel = new URL(redirects.cancelUrl);
  assert.equal(success.searchParams.get("session_id"), "{CHECKOUT_SESSION_ID}");
  assert.equal(success.searchParams.get("orderId"), "order-id");
  assert.equal(cancel.searchParams.get("orderId"), "order-id");
  assert.match(redirects.successUrl, /session_id=\{CHECKOUT_SESSION_ID\}/);
});

test("Stripe amount and currency must exactly match server values", () => {
  const amount = new Prisma.Decimal("500.25");
  assert.equal(toStripeMinorUnits(amount), 50025);
  assert.equal(stripePaymentMatches(amount, "BDT", 50025, "bdt"), true);
  assert.equal(stripePaymentMatches(amount, "BDT", 50024, "bdt"), false);
  assert.equal(stripePaymentMatches(amount, "BDT", 50025, "usd"), false);
});

test("payment completion is evaluated at Stripe capture time, not delayed webhook time", () => {
  const deadline = new Date("2026-10-28T13:19:39.017Z");
  assert.equal(paymentCompletedBeforeDeadline(new Date("2026-10-28T13:12:05.000Z"), deadline), true);
  assert.equal(paymentCompletedBeforeDeadline(new Date("2026-10-28T13:20:00.000Z"), deadline), false);
  assert.equal(paymentCompletedBeforeDeadline(new Date(), null), true);
});
