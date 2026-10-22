import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";

import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { verifyStripeEvent } from "./payment-webhook.service.js";

test("Stripe webhook accepts the original raw body with a valid signature", () => {
  const secret = "whsec_test_dermacare_signature_secret";
  Object.assign(env, { STRIPE_SECRET_KEY: "sk_test_dermacare", STRIPE_WEBHOOK_SECRET: secret });
  const payload = JSON.stringify({
    id: "evt_test",
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test", object: "checkout.session" } },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });

  assert.equal(verifyStripeEvent(Buffer.from(payload), signature).id, "evt_test");
});

test("Stripe webhook rejects a changed body or invalid signature", () => {
  const secret = "whsec_test_dermacare_signature_secret";
  Object.assign(env, { STRIPE_SECRET_KEY: "sk_test_dermacare", STRIPE_WEBHOOK_SECRET: secret });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: "{}", secret });

  assert.throws(
    () => verifyStripeEvent(Buffer.from('{"changed":true}'), signature),
    (error: unknown) => error instanceof AppError && error.statusCode === 400,
  );
});

test("TEST-01: End-to-end Stripe webhook payload verification with valid test signature", () => {
  const secret = "whsec_test_dermacare_signature_secret";
  Object.assign(env, { STRIPE_SECRET_KEY: "sk_test_dermacare", STRIPE_WEBHOOK_SECRET: secret });
  const payload = JSON.stringify({
    id: "evt_test_checkout_completed",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_session_id_123",
        object: "checkout.session",
        payment_status: "paid",
        metadata: {
          context: "appointment",
          entityId: "550e8400-e29b-41d4-a716-446655440000",
          patientId: "660e8400-e29b-41d4-a716-446655440000",
        },
      },
    },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  const verifiedEvent = verifyStripeEvent(Buffer.from(payload), signature);
  assert.equal(verifiedEvent.id, "evt_test_checkout_completed");
  assert.equal(verifiedEvent.type, "checkout.session.completed");
  assert.equal(verifiedEvent.data.object.id, "cs_test_session_id_123");
});
