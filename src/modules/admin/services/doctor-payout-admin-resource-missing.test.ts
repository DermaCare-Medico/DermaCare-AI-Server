import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";

import { AppError } from "../../../shared/errors/AppError.js";
import { isStripeCheckoutSessionResourceMissing } from "./doctor-payout-admin.service.js";

test("resource_missing is identified only for Stripe Checkout retrieval errors", () => {
  const error = new Stripe.errors.StripeInvalidRequestError({
    message: "No such checkout.session: cs_missing",
    code: "resource_missing",
    param: "id",
  });
  assert.equal(isStripeCheckoutSessionResourceMissing(error), true);
  assert.equal(isStripeCheckoutSessionResourceMissing(new Error("resource_missing")), false);
  assert.equal(isStripeCheckoutSessionResourceMissing(new Stripe.errors.StripeInvalidRequestError({
    message: "Bad request",
    code: "parameter_invalid",
  })), false);
});

test("resource_missing response remains an actionable conflict", () => {
  const response = new AppError(
    "The stored Stripe Checkout Session could not be found in the currently configured Stripe account. Verify the Stripe account/API key before taking further action.",
    409,
  );
  assert.equal(response.statusCode, 409);
  assert.match(response.message, /currently configured Stripe account/);
});
