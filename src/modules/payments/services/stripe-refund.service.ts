import Stripe from "stripe";

import {
  Prisma,
  PayoutStatus,
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
export const refundFailureAuditMetadata = () => ({
  failureCode: "STRIPE_REFUND_REQUEST_FAILED",
} as const);

export async function reconcileRefundedAppointmentPayout(
  tx: Prisma.TransactionClient,
  appointmentId: string,
) {
  const item = await tx.doctorPayoutItem.findUnique({
    where: { appointmentId },
    select: {
      id: true,
      consultationAmount: true,
      platformFee: true,
      doctorAmount: true,
      payout: { select: { id: true, status: true, transactionReference: true } },
    },
  });
  if (!item || item.payout.status === PayoutStatus.PAID) return null;
  if (item.payout.status !== PayoutStatus.PENDING && item.payout.status !== PayoutStatus.PROCESSING) {
    return null;
  }

  const claimed = await tx.doctorPayout.updateMany({
    where: { id: item.payout.id, status: item.payout.status },
    data: {
      totalConsultations: { decrement: 1 },
      grossAmount: { decrement: item.consultationAmount },
      platformFee: { decrement: item.platformFee },
      netAmount: { decrement: item.doctorAmount },
      ...(item.payout.status === PayoutStatus.PROCESSING && { status: PayoutStatus.FAILED }),
    },
  });
  if (claimed.count !== 1) return null;
  await tx.doctorPayoutItem.delete({ where: { id: item.id } });
  return item.payout.status === PayoutStatus.PROCESSING ? item.payout.transactionReference : null;
}

export async function stagePaymentRefunds(
  tx: Prisma.TransactionClient,
  target: { appointmentId: string } | { orderId: string } | { id: string },
) {
  const payments = await tx.paymentTransaction.findMany({
    where: { ...target, status: TransactionStatus.PAID },
    select: {
      id: true,
      provider: true,
      refundStatus: true,
      patient: { select: { userId: true } },
    },
  });
  const stripePaymentIds: string[] = [];
  let consultationRefunded = false;
  for (const payment of payments) {
    if (payment.provider === "STRIPE") {
      if (payment.refundStatus !== RefundStatus.SUCCEEDED) {
        if (payment.refundStatus !== RefundStatus.PENDING) {
        await tx.paymentTransaction.update({
          where: { id: payment.id },
          data: { refundStatus: RefundStatus.PENDING, refundError: null },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: payment.patient.userId,
            action: "STRIPE_REFUND_STATUS_CHANGED",
            entityType: "PaymentTransaction",
            entityId: payment.id,
            before: { refundStatus: payment.refundStatus },
            after: { refundStatus: RefundStatus.PENDING },
          },
        });
        }
        stripePaymentIds.push(payment.id);
      }
    } else if (payment.provider === "DEMO") {
      await tx.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          status: TransactionStatus.REFUNDED,
          refundStatus: RefundStatus.SUCCEEDED,
          refundedAt: new Date(),
          refundError: null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: payment.patient.userId,
          action: "DEMO_REFUND_COMPLETED",
          entityType: "PaymentTransaction",
          entityId: payment.id,
          before: { status: TransactionStatus.PAID, refundStatus: payment.refundStatus },
          after: { status: TransactionStatus.REFUNDED, refundStatus: RefundStatus.SUCCEEDED },
        },
      });
      consultationRefunded = true;
    } else {
      await tx.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          refundStatus: RefundStatus.FAILED,
          refundError: "Automatic refunds are not supported for this payment provider",
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: payment.patient.userId,
          action: "REFUND_UNSUPPORTED",
          entityType: "PaymentTransaction",
          entityId: payment.id,
          before: { refundStatus: payment.refundStatus },
          after: { refundStatus: RefundStatus.FAILED },
        },
      });
    }
  }
  if (consultationRefunded && "appointmentId" in target) {
    await reconcileRefundedAppointmentPayout(tx, target.appointmentId);
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
  const paymentIntentId = typeof refund.payment_intent === "string"
    ? refund.payment_intent
    : refund.payment_intent?.id;
  const checkoutToExpire = await prisma.$transaction(async (tx) => {
    const payment = await tx.paymentTransaction.findUnique({
      where: { id: paymentId },
      select: {
        appointmentId: true,
        refundStatus: true,
        patient: { select: { userId: true } },
      },
    });
    const updated = await tx.paymentTransaction.updateMany({
      where: {
        id: paymentId,
        provider: "STRIPE",
        status: TransactionStatus.PAID,
        OR: [
          { refundStatus: null },
          { refundStatus: { not: refundStatus } },
        ],
      },
      data: {
        ...(paymentIntentId && { stripePaymentIntentId: paymentIntentId }),
        stripeRefundId: refund.id,
        refundStatus,
        refundError: refund.failure_reason ?? null,
        ...(refundStatus === RefundStatus.SUCCEEDED && {
          status: TransactionStatus.REFUNDED,
          refundedAt: new Date(),
        }),
      },
    });
    if (updated.count === 1 && payment) {
      await tx.auditLog.create({
        data: {
          actorUserId: payment.patient.userId,
          action: "STRIPE_REFUND_STATUS_CHANGED",
          entityType: "PaymentTransaction",
          entityId: paymentId,
          before: { refundStatus: payment.refundStatus },
          after: { refundStatus, paymentStatus: refundStatus === RefundStatus.SUCCEEDED
            ? TransactionStatus.REFUNDED : TransactionStatus.PAID },
        },
      });
    }
    if (updated.count !== 1 || refundStatus !== RefundStatus.SUCCEEDED || !payment?.appointmentId) return null;
    return reconcileRefundedAppointmentPayout(tx, payment.appointmentId);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (checkoutToExpire) {
    try {
      await stripe().checkout.sessions.expire(checkoutToExpire);
      await prisma.doctorPayout.updateMany({
        where: { status: PayoutStatus.FAILED, transactionReference: checkoutToExpire },
        data: { status: PayoutStatus.PENDING },
      });
    } catch {
      // FAILED intentionally blocks payment until the stale Checkout Session can no longer complete.
    }
  }
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
  if (!payment || payment.provider !== "STRIPE" || payment.status === TransactionStatus.REFUNDED) return true;
  if (payment.status !== TransactionStatus.PAID) return true;

  try {
    if (payment.stripeRefundId) {
      const existing = await stripe().refunds.retrieve(payment.stripeRefundId);
      await persistRefund(payment.id, existing);
      return true;
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
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Stripe refund request failed";
    await prisma.$transaction(async (tx) => {
      const current = await tx.paymentTransaction.findUnique({
        where: { id: payment.id },
        select: { refundStatus: true, patient: { select: { userId: true } } },
      });
      const updated = await tx.paymentTransaction.updateMany({
        where: { id: payment.id, provider: "STRIPE", status: TransactionStatus.PAID },
        data: { refundStatus: RefundStatus.FAILED, refundError: message },
      });
      if (updated.count === 1 && current?.refundStatus !== RefundStatus.FAILED) {
        await tx.auditLog.create({
          data: {
            actorUserId: current?.patient.userId,
            action: "STRIPE_REFUND_STATUS_CHANGED",
            entityType: "PaymentTransaction",
            entityId: payment.id,
            before: { refundStatus: current?.refundStatus ?? null },
            after: { refundStatus: RefundStatus.FAILED },
            metadata: refundFailureAuditMetadata(),
          },
        });
      }
    });
    return false;
  }
}

export async function requestStripeRefunds(paymentIds: string[]) {
  const results = await Promise.all(paymentIds.map(async (paymentId) => ({
    paymentId,
    succeeded: await requestStripeRefund(paymentId),
  })));
  return results.filter((result) => !result.succeeded).map((result) => result.paymentId);
}

export type RefundRequestResult = {
  status: "NOT_REQUIRED" | "PROCESSING" | "COMPLETED" | "FAILED";
  failedPaymentIds: string[];
};

export const summarizeRefundRequests = (
  paymentIds: string[],
  failedPaymentIds: string[],
  statuses: Array<RefundStatus | null>,
): RefundRequestResult => {
  if (paymentIds.length === 0) return { status: "NOT_REQUIRED", failedPaymentIds: [] };
  if (failedPaymentIds.length > 0 || statuses.includes(RefundStatus.FAILED)) {
    return { status: "FAILED", failedPaymentIds };
  }
  if (statuses.length === paymentIds.length && statuses.every((status) => status === RefundStatus.SUCCEEDED)) {
    return { status: "COMPLETED", failedPaymentIds: [] };
  }
  return { status: "PROCESSING", failedPaymentIds: [] };
};

export async function requestStripeRefundsWithResult(paymentIds: string[]): Promise<RefundRequestResult> {
  const failedPaymentIds = await requestStripeRefunds(paymentIds);
  const payments = paymentIds.length === 0 ? [] : await prisma.paymentTransaction.findMany({
    where: { id: { in: paymentIds } },
    select: { refundStatus: true },
  });
  return summarizeRefundRequests(
    paymentIds,
    failedPaymentIds,
    payments.map(({ refundStatus }) => refundStatus),
  );
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
    select: { id: true, amount: true, status: true, stripePaymentIntentId: true },
  });
  if (!payment || payment.status === TransactionStatus.REFUNDED) return;
  if (refund.amount !== toStripeMinorUnits(payment.amount)) return;
  const refundPaymentIntentId = typeof refund.payment_intent === "string"
    ? refund.payment_intent
    : refund.payment_intent?.id;
  if (payment.stripePaymentIntentId
    && refundPaymentIntentId !== payment.stripePaymentIntentId) return;
  await persistRefund(payment.id, refund);
}
