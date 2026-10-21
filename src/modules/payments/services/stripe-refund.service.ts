import Stripe from "stripe";

import {
  Prisma,
  RefundStatus,
  TransactionStatus,
} from "../../../generated/prisma/client.js";
import { env } from "../../../config/env.js";
import { prisma } from "../../../lib/prisma.js";
import { toStripeMinorUnits } from "./stripe-payment.rules.js";

let stripeClient: Stripe | undefined;
const stripe = () => {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
};

export function refundStateForStripeStatus(status: Stripe.Refund["status"] | null) {
  if (status === "succeeded") return RefundStatus.SUCCEEDED;
  if (status === "failed" || status === "canceled") return RefundStatus.FAILED;
  return RefundStatus.PENDING;
}

export const stripeRefundIdempotencyKey = (paymentId: string) => `payment-refund-${paymentId}`;

export async function stagePaymentRefunds(
  tx: Prisma.TransactionClient,
  target: { appointmentId: string } | { orderId: string },
) {
  const payments = await tx.paymentTransaction.findMany({
    where: { ...target, status: TransactionStatus.PAID },
    select: { id: true, provider: true, refundStatus: true },
  });
  const stripePaymentIds: string[] = [];
  for (const payment of payments) {
    if (payment.provider === "STRIPE") {
      if (payment.refundStatus !== RefundStatus.SUCCEEDED) {
        await tx.paymentTransaction.update({
          where: { id: payment.id },
          data: { refundStatus: RefundStatus.PENDING, refundError: null },
        });
        stripePaymentIds.push(payment.id);
      }
    } else {
      await tx.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          status: TransactionStatus.REFUNDED,
          refundStatus: RefundStatus.SUCCEEDED,
          refundedAt: new Date(),
          refundError: null,
        },
      });
    }
  }
  return stripePaymentIds;
}

async function resolvePaymentIntent(payment: {
  id: string;
  providerTransactionId: string | null;
  stripePaymentIntentId: string | null;
}) {
  if (payment.stripePaymentIntentId) return payment.stripePaymentIntentId;
  if (!payment.providerTransactionId) throw new Error("Stripe Checkout session reference is missing");
  const session = await stripe().checkout.sessions.retrieve(payment.providerTransactionId);
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;
  if (!paymentIntentId) throw new Error("Stripe PaymentIntent reference is missing");
  await prisma.paymentTransaction.updateMany({
    where: { id: payment.id, stripePaymentIntentId: null },
    data: { stripePaymentIntentId: paymentIntentId },
  });
  return paymentIntentId;
}

async function persistRefund(paymentId: string, refund: Stripe.Refund) {
  const refundStatus = refundStateForStripeStatus(refund.status);
  await prisma.paymentTransaction.updateMany({
    where: { id: paymentId, provider: "STRIPE", status: TransactionStatus.PAID },
    data: {
      stripeRefundId: refund.id,
      refundStatus,
      refundError: refund.failure_reason ?? null,
      ...(refundStatus === RefundStatus.SUCCEEDED && {
        status: TransactionStatus.REFUNDED,
        refundedAt: new Date(),
      }),
    },
  });
}

export async function requestStripeRefund(paymentId: string) {
  const payment = await prisma.paymentTransaction.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      provider: true,
      providerTransactionId: true,
      stripePaymentIntentId: true,
      stripeRefundId: true,
      refundStatus: true,
      status: true,
    },
  });
  if (!payment || payment.provider !== "STRIPE" || payment.status === TransactionStatus.REFUNDED) return;
  if (payment.status !== TransactionStatus.PAID) return;

  try {
    if (payment.stripeRefundId) {
      const existing = await stripe().refunds.retrieve(payment.stripeRefundId);
      await persistRefund(payment.id, existing);
      return;
    }
    const paymentIntentId = await resolvePaymentIntent(payment);
    const intent = await stripe().paymentIntents.retrieve(paymentIntentId);
    const chargeId = typeof intent.latest_charge === "string"
      ? intent.latest_charge
      : intent.latest_charge?.id;
    if (chargeId) {
      await prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: { stripeChargeId: chargeId },
      });
    }
    const refund = await stripe().refunds.create({
      payment_intent: paymentIntentId,
      reason: "requested_by_customer",
      metadata: { paymentTransactionId: payment.id },
    }, { idempotencyKey: stripeRefundIdempotencyKey(payment.id) });
    await persistRefund(payment.id, refund);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Stripe refund request failed";
    await prisma.paymentTransaction.updateMany({
      where: { id: payment.id, provider: "STRIPE", status: TransactionStatus.PAID },
      data: { refundStatus: RefundStatus.FAILED, refundError: message },
    });
  }
}

export async function requestStripeRefunds(paymentIds: string[]) {
  await Promise.all(paymentIds.map(requestStripeRefund));
}

export async function reconcileStripeRefund(refund: Stripe.Refund) {
  const paymentId = refund.metadata?.paymentTransactionId;
  const payment = await prisma.paymentTransaction.findFirst({
    where: {
      provider: "STRIPE",
      OR: [
        { stripeRefundId: refund.id },
        ...(paymentId ? [{ id: paymentId }] : []),
      ],
    },
    select: { id: true, amount: true, status: true },
  });
  if (!payment || payment.status === TransactionStatus.REFUNDED) return;
  if (refund.amount !== toStripeMinorUnits(payment.amount)) return;
  await persistRefund(payment.id, refund);
}
