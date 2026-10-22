import assert from "node:assert/strict";
import test from "node:test";

import {
  Prisma,
  PayoutStatus,
  RefundStatus,
  TransactionStatus,
} from "../../../generated/prisma/client.js";
import {
  refundStateForStripeStatus,
  reconcileRefundedAppointmentPayout,
  stagePaymentRefunds,
  stripeRefundIdempotencyKey,
  summarizeRefundRequests,
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
        { id: "stripe-payment", provider: "STRIPE", refundStatus: null, patient: { userId: "patient-user" } },
        { id: "demo-payment", provider: "DEMO", refundStatus: null, patient: { userId: "patient-user" } },
        { id: "legacy-payment", provider: null, refundStatus: null, patient: { userId: "patient-user" } },
      ],
      update: async (args: { where: unknown; data: Record<string, unknown> }) => {
        updates.push(args);
        return args;
      },
    },
    auditLog: { create: async (args: unknown) => args },
    doctorPayoutItem: { findUnique: async () => null },
  } as unknown as Prisma.TransactionClient;

  const ids = await stagePaymentRefunds(tx, { appointmentId: "appointment-id" });

  assert.deepEqual(ids, ["stripe-payment"]);
  assert.equal(updates[0]!.data.refundStatus, RefundStatus.PENDING);
  assert.equal(updates[0]!.data.status, undefined);
  assert.equal(updates[1]!.data.status, TransactionStatus.REFUNDED);
  assert.equal(updates[2]!.data.status, undefined);
  assert.equal(updates[2]!.data.refundStatus, RefundStatus.FAILED);
  assert.match(String(updates[2]!.data.refundError), /not supported/i);
});

test("post-generation refund removes an unpaid ledger item and recalculates its payout", async () => {
  const payoutUpdates: any[] = [];
  const deleted: string[] = [];
  const tx = {
    doctorPayoutItem: {
      findUnique: async () => ({
        id: "item-1",
        consultationAmount: new Prisma.Decimal("100"),
        platformFee: new Prisma.Decimal("15"),
        doctorAmount: new Prisma.Decimal("85"),
        payout: { id: "payout-1", status: PayoutStatus.PENDING, transactionReference: null },
      }),
      delete: async ({ where }: any) => deleted.push(where.id),
    },
    doctorPayout: {
      updateMany: async (args: any) => { payoutUpdates.push(args); return { count: 1 }; },
    },
  } as unknown as Prisma.TransactionClient;
  assert.equal(await reconcileRefundedAppointmentPayout(tx, "appointment-1"), null);
  assert.deepEqual(deleted, ["item-1"]);
  assert.equal(payoutUpdates[0].data.totalConsultations.decrement, 1);
  assert.equal(payoutUpdates[0].data.netAmount.decrement.toString(), "85");
});

test("post-generation refund preserves an already-paid payout as immutable history", async () => {
  let mutated = false;
  const tx = {
    doctorPayoutItem: { findUnique: async () => ({
      id: "item-1", consultationAmount: new Prisma.Decimal(100), platformFee: new Prisma.Decimal(15),
      doctorAmount: new Prisma.Decimal(85), payout: { id: "payout-1", status: PayoutStatus.PAID, transactionReference: "cs_paid" },
    }), delete: async () => { mutated = true; } },
    doctorPayout: { updateMany: async () => { mutated = true; return { count: 1 }; } },
  } as unknown as Prisma.TransactionClient;
  assert.equal(await reconcileRefundedAppointmentPayout(tx, "appointment-1"), null);
  assert.equal(mutated, false);
});

test("refund blocks an in-flight payout and returns its Checkout Session for expiry", async () => {
  const tx = {
    doctorPayoutItem: { findUnique: async () => ({
      id: "item-1", consultationAmount: new Prisma.Decimal(100), platformFee: new Prisma.Decimal(15),
      doctorAmount: new Prisma.Decimal(85), payout: { id: "payout-1", status: PayoutStatus.PROCESSING, transactionReference: "cs_open" },
    }), delete: async () => ({}) },
    doctorPayout: { updateMany: async (args: any) => {
      assert.equal(args.data.status, PayoutStatus.FAILED);
      return { count: 1 };
    } },
  } as unknown as Prisma.TransactionClient;
  assert.equal(await reconcileRefundedAppointmentPayout(tx, "appointment-1"), "cs_open");
});

test("duplicate refund requests use the same Stripe idempotency key", () => {
  assert.equal(
    stripeRefundIdempotencyKey("payment-id"),
    stripeRefundIdempotencyKey("payment-id"),
  );
});

test("cancellation refund reporting distinguishes processing, verified completion and failure", () => {
  assert.deepEqual(summarizeRefundRequests([], [], []), {
    status: "NOT_REQUIRED", failedPaymentIds: [],
  });
  assert.equal(summarizeRefundRequests(["payment-1"], [], [RefundStatus.PENDING]).status, "PROCESSING");
  assert.equal(summarizeRefundRequests(["payment-1"], [], [RefundStatus.SUCCEEDED]).status, "COMPLETED");
  assert.deepEqual(summarizeRefundRequests(["payment-1"], ["payment-1"], [RefundStatus.FAILED]), {
    status: "FAILED", failedPaymentIds: ["payment-1"],
  });
});

test("a pending Stripe refund is never reported as completed", () => {
  const result = summarizeRefundRequests(
    ["payment-1", "payment-2"],
    [],
    [RefundStatus.SUCCEEDED, RefundStatus.PENDING],
  );
  assert.equal(result.status, "PROCESSING");
});
