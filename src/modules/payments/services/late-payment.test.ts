import assert from "node:assert/strict";
import test from "node:test";

import {
  Prisma,
  RefundStatus,
  TransactionStatus,
} from "../../../generated/prisma/client.js";
import { expireStripeCheckoutSessions } from "./payment-verification.service.js";
import {
  assertLateRefundRequestsSucceeded,
  stageCapturedStripePaymentForRefund,
} from "./payment-webhook.service.js";

const transaction = (initialStatus: TransactionStatus) => {
  let status = initialStatus;
  const updates: Array<Record<string, unknown>> = [];
  const tx = {
    paymentTransaction: {
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        if (data.status) status = data.status as TransactionStatus;
        return { count: 1 };
      },
      findMany: async () => status === TransactionStatus.PAID
        ? [{
          id: "payment-id",
          provider: "STRIPE",
          refundStatus: null,
          patient: { userId: "patient-user-id" },
        }]
        : [],
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { id: "payment-id" };
      },
    },
    auditLog: { create: async () => ({ id: "audit-id" }) },
  } as unknown as Prisma.TransactionClient;
  return { tx, updates, status: () => status };
};

test("late captured payment is recorded PAID before its durable refund is staged", async () => {
  const state = transaction(TransactionStatus.PENDING);
  const ids = await stageCapturedStripePaymentForRefund(state.tx, {
    id: "payment-id",
    status: TransactionStatus.PENDING,
    stripePaymentIntentId: null,
  }, "pi_late");

  assert.deepEqual(ids, ["payment-id"]);
  assert.equal(state.status(), TransactionStatus.PAID);
  assert.equal(state.updates[0]!.stripePaymentIntentId, "pi_late");
  assert.equal(state.updates[1]!.refundStatus, RefundStatus.PENDING);
});

test("a prior failed or duplicate late webhook remains retryable and idempotent", async () => {
  for (const status of [TransactionStatus.FAILED, TransactionStatus.PAID]) {
    const state = transaction(status);
    const ids = await stageCapturedStripePaymentForRefund(state.tx, {
      id: "payment-id",
      status,
      stripePaymentIntentId: status === TransactionStatus.PAID ? "pi_late" : null,
    }, "pi_late");
    assert.deepEqual(ids, ["payment-id"]);
    assert.equal(state.updates.at(-1)!.refundStatus, RefundStatus.PENDING);
  }
});

test("out-of-order events cannot reopen a completed refund or replace its PaymentIntent", async () => {
  const refunded = transaction(TransactionStatus.REFUNDED);
  assert.deepEqual(await stageCapturedStripePaymentForRefund(refunded.tx, {
    id: "payment-id",
    status: TransactionStatus.REFUNDED,
    stripePaymentIntentId: "pi_original",
  }, "pi_original"), []);
  assert.equal(refunded.updates.length, 0);

  const paid = transaction(TransactionStatus.PAID);
  await assert.rejects(() => stageCapturedStripePaymentForRefund(paid.tx, {
    id: "payment-id",
    status: TransactionStatus.PAID,
    stripePaymentIntentId: "pi_original",
  }, "pi_other"), /PaymentIntent does not match/);
});

test("expiry closes each open Checkout Session once and tolerates capture races", async () => {
  const calls: string[] = [];
  await expireStripeCheckoutSessions(["cs_one", "cs_one", "cs_captured"], async (id) => {
    calls.push(id);
    if (id === "cs_captured") throw new Error("session is no longer open");
  });
  assert.deepEqual(calls.sort(), ["cs_captured", "cs_one"]);
});

test("failed late refunds remain observable and force Stripe webhook retry", () => {
  assert.doesNotThrow(() => assertLateRefundRequestsSucceeded([]));
  assert.throws(
    () => assertLateRefundRequestsSucceeded(["payment-id"]),
    /will be retried/,
  );
});
