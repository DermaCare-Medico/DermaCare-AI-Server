import assert from "node:assert/strict";
import test from "node:test";

import {
  Prisma,
  RefundStatus,
  TransactionStatus,
} from "../../../generated/prisma/client.js";
import {
  refundStateForStripeStatus,
  stagePaymentRefunds,
  stripeRefundIdempotencyKey,
} from "./stripe-refund.service.js";

test("succeeded Stripe refund is the only successful refund state", () => {
  assert.equal(refundStateForStripeStatus("succeeded"), RefundStatus.SUCCEEDED);
});

test("pending and requires-action Stripe refunds remain pending", () => {
  assert.equal(refundStateForStripeStatus("pending"), RefundStatus.PENDING);
  assert.equal(refundStateForStripeStatus("requires_action"), RefundStatus.PENDING);
});

test("failed or canceled Stripe refunds are failed, not refunded", () => {
  assert.equal(refundStateForStripeStatus("failed"), RefundStatus.FAILED);
  assert.equal(refundStateForStripeStatus("canceled"), RefundStatus.FAILED);
});

test("staging keeps Stripe money PAID and only immediately refunds demo payments", async () => {
  const updates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  const tx = {
    paymentTransaction: {
      findMany: async () => [
        { id: "stripe-payment", provider: "STRIPE", refundStatus: null },
        { id: "demo-payment", provider: "DEMO", refundStatus: null },
      ],
      update: async (args: { where: unknown; data: Record<string, unknown> }) => {
        updates.push(args);
        return args;
      },
    },
  } as unknown as Prisma.TransactionClient;

  const ids = await stagePaymentRefunds(tx, { appointmentId: "appointment-id" });

  assert.deepEqual(ids, ["stripe-payment"]);
  assert.equal(updates[0]!.data.refundStatus, RefundStatus.PENDING);
  assert.equal(updates[0]!.data.status, undefined);
  assert.equal(updates[1]!.data.status, TransactionStatus.REFUNDED);
});

test("duplicate refund requests use the same Stripe idempotency key", () => {
  assert.equal(
    stripeRefundIdempotencyKey("payment-id"),
    stripeRefundIdempotencyKey("payment-id"),
  );
});
