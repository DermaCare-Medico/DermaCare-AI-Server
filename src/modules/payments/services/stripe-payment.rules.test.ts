import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "../../../generated/prisma/client.js";
import {
  buildCheckoutRedirects,
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
});

test("order checkout redirects carry session and order context", () => {
  const redirects = buildCheckoutRedirects("https://client.example/app", "order", "order-id");
  const success = new URL(redirects.successUrl);
  const cancel = new URL(redirects.cancelUrl);
  assert.equal(success.searchParams.get("session_id"), "{CHECKOUT_SESSION_ID}");
  assert.equal(success.searchParams.get("orderId"), "order-id");
  assert.equal(cancel.searchParams.get("orderId"), "order-id");
});

test("Stripe amount and currency must exactly match server values", () => {
  const amount = new Prisma.Decimal("500.25");
  assert.equal(toStripeMinorUnits(amount), 50025);
  assert.equal(stripePaymentMatches(amount, "BDT", 50025, "bdt"), true);
  assert.equal(stripePaymentMatches(amount, "BDT", 50024, "bdt"), false);
  assert.equal(stripePaymentMatches(amount, "BDT", 50025, "usd"), false);
});
