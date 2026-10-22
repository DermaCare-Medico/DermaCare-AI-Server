import Stripe from "stripe";

import {
  AppointmentStatus,
  MeetingProvisioningStatus,
  NotificationType,
  OrderStatus,
  Prisma,
  SlotStatus,
  TransactionPurpose,
  TransactionStatus,
} from "../../../generated/prisma/client.js";
import { env } from "../../../config/env.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { requestMeetingProvisioning } from "../../../integrations/google-calendar/meeting-provisioning.worker.js";
import { createNotificationIfEligible } from "../../notifications/services/notification.service.js";
import { isOrderPaymentExpired } from "../../orders/services/order-payment.rules.js";
import { stripePaymentMatches } from "./stripe-payment.rules.js";
import {
  reconcileStripeRefund,
  requestStripeRefunds,
  stagePaymentRefunds,
} from "./stripe-refund.service.js";

let stripeClient: Stripe | undefined;
const stripe = () => {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError("Stripe webhook is not configured", 503);
  }
  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
};

export function verifyStripeEvent(rawBody: Buffer, signature: string) {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new AppError("Stripe webhook is not configured", 503);
  try {
    return stripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new AppError("Invalid Stripe webhook signature", 400);
  }
}

async function markUnsuccessful(session: Stripe.Checkout.Session) {
  await prisma.paymentTransaction.updateMany({
    where: {
      provider: "STRIPE",
      providerTransactionId: session.id,
      status: TransactionStatus.PENDING,
    },
    data: { status: TransactionStatus.FAILED },
  });
}

export async function stageCapturedStripePaymentForRefund(
  tx: Prisma.TransactionClient,
  payment: { id: string; status: TransactionStatus; stripePaymentIntentId: string | null },
  paymentIntentId: string,
) {
  if (payment.status === TransactionStatus.REFUNDED) return [];
  if (payment.stripePaymentIntentId && payment.stripePaymentIntentId !== paymentIntentId) {
    throw new AppError("Stripe PaymentIntent does not match the recorded payment", 400);
  }

  if (payment.status !== TransactionStatus.PAID) {
    const captured = await tx.paymentTransaction.updateMany({
      where: {
        id: payment.id,
        status: { in: [TransactionStatus.PENDING, TransactionStatus.FAILED] },
      },
      data: {
        status: TransactionStatus.PAID,
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
      },
    });
    if (captured.count !== 1) return [];
  } else if (!payment.stripePaymentIntentId) {
    await tx.paymentTransaction.updateMany({
      where: { id: payment.id, stripePaymentIntentId: null },
      data: { stripePaymentIntentId: paymentIntentId },
    });
  }

  return stagePaymentRefunds(tx, { id: payment.id });
}

export function assertLateRefundRequestsSucceeded(failedPaymentIds: string[]) {
  if (failedPaymentIds.length > 0) {
    throw new AppError("Captured late payment refund failed and will be retried", 502);
  }
}

async function completeAppointment(session: Stripe.Checkout.Session, paymentId: string) {
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;
  if (!paymentIntentId) throw new AppError("Stripe PaymentIntent reference is missing", 400);
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.paymentTransaction.findUnique({
      where: { id: paymentId },
      select: {
        id: true, patientId: true, appointmentId: true, amount: true, currency: true, status: true,
        stripePaymentIntentId: true,
        appointment: {
          select: {
            id: true, patientId: true, doctorId: true, slotId: true, status: true, holdExpiresAt: true,
            doctor: { select: { userId: true, consultationFee: true } },
          },
        },
        patient: { select: { userId: true } },
      },
    });
    if (!payment?.appointment || !payment.appointmentId) throw new AppError("Invalid appointment payment", 400);
    if (session.metadata?.context !== "appointment"
      || session.metadata.entityId !== payment.appointmentId
      || session.metadata.patientId !== payment.patientId
      || payment.appointment.patientId !== payment.patientId
      || !payment.amount.equals(payment.appointment.doctor.consultationFee)
      || !stripePaymentMatches(payment.amount, payment.currency, session.amount_total, session.currency)) {
      throw new AppError("Stripe payment details do not match the appointment", 400);
    }
    if (payment.appointment.status !== AppointmentStatus.PENDING
      || (payment.appointment.holdExpiresAt && payment.appointment.holdExpiresAt <= new Date())) {
      const refundPaymentIds = await stageCapturedStripePaymentForRefund(
        tx,
        payment,
        paymentIntentId,
      );
      return { completed: false, refundPaymentIds };
    }

    if (payment.status === TransactionStatus.PAID) {
      if (payment.stripePaymentIntentId && payment.stripePaymentIntentId !== paymentIntentId) {
        throw new AppError("Stripe PaymentIntent does not match the recorded payment", 400);
      }
      return { completed: false, refundPaymentIds: [] as string[] };
    }
    if (payment.status !== TransactionStatus.PENDING
      && payment.status !== TransactionStatus.FAILED) {
      return { completed: false, refundPaymentIds: [] as string[] };
    }

    const claimed = await tx.paymentTransaction.updateMany({
      where: {
        id: payment.id,
        status: { in: [TransactionStatus.PENDING, TransactionStatus.FAILED] },
      },
      data: {
        status: TransactionStatus.PAID,
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
      },
    });
    if (claimed.count !== 1) return { completed: false, refundPaymentIds: [] as string[] };
    const appointment = await tx.appointment.updateMany({
      where: {
        id: payment.appointment.id,
        patientId: payment.patientId,
        status: AppointmentStatus.PENDING,
        payments: { none: { purpose: TransactionPurpose.APPOINTMENT, status: TransactionStatus.PAID, id: { not: payment.id } } },
      },
      data: {
        status: AppointmentStatus.CONFIRMED,
        meetingProvisioningStatus: MeetingProvisioningStatus.PENDING,
        meetingProvisioningNextAttemptAt: new Date(),
        meetingProvisioningError: null,
      },
    });
    if (appointment.count !== 1) throw new AppError("Appointment is no longer payable", 409);
    const slot = await tx.doctorSlot.updateMany({
      where: { id: payment.appointment.slotId, doctorId: payment.appointment.doctorId, status: SlotStatus.HELD },
      data: { status: SlotStatus.BOOKED },
    });
    if (slot.count !== 1) throw new AppError("Appointment slot is no longer payable", 409);
    await createNotificationIfEligible({
      userId: payment.patient.userId,
      title: "Appointment payment successful",
      message: "Your appointment payment was successful and the appointment is confirmed.",
      notificationType: NotificationType.PAYMENT,
      relatedEntityType: "Appointment",
      relatedEntityId: payment.appointment.id,
    }, tx);
    await createNotificationIfEligible({
      userId: payment.appointment.doctor.userId,
      title: "Appointment confirmed",
      message: "An appointment has been confirmed after successful payment.",
      notificationType: NotificationType.APPOINTMENT,
      relatedEntityType: "Appointment",
      relatedEntityId: payment.appointment.id,
    }, tx);
    return { completed: true, refundPaymentIds: [] as string[] };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  assertLateRefundRequestsSucceeded(await requestStripeRefunds(result.refundPaymentIds));
  if (result.completed) requestMeetingProvisioning();
}

async function completeOrder(session: Stripe.Checkout.Session, paymentId: string) {
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;
  if (!paymentIntentId) throw new AppError("Stripe PaymentIntent reference is missing", 400);
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.paymentTransaction.findUnique({
      where: { id: paymentId },
      select: {
        id: true, patientId: true, orderId: true, amount: true, currency: true, status: true,
        stripePaymentIntentId: true,
        order: { select: { id: true, patientId: true, status: true, paymentExpiresAt: true, totalAmount: true } },
        patient: { select: { userId: true } },
      },
    });
    if (!payment?.order || !payment.orderId) throw new AppError("Invalid order payment", 400);
    if (session.metadata?.context !== "order"
      || session.metadata.entityId !== payment.orderId
      || session.metadata.patientId !== payment.patientId
      || payment.order.patientId !== payment.patientId
      || !payment.amount.equals(payment.order.totalAmount)
      || !stripePaymentMatches(payment.amount, payment.currency, session.amount_total, session.currency)) {
      throw new AppError("Stripe payment details do not match the order", 400);
    }
    if (payment.order.status !== OrderStatus.PENDING || isOrderPaymentExpired(payment.order.paymentExpiresAt)) {
      const refundPaymentIds = await stageCapturedStripePaymentForRefund(
        tx,
        payment,
        paymentIntentId,
      );
      return { refundPaymentIds };
    }
    if (payment.status === TransactionStatus.PAID) {
      if (payment.stripePaymentIntentId && payment.stripePaymentIntentId !== paymentIntentId) {
        throw new AppError("Stripe PaymentIntent does not match the recorded payment", 400);
      }
      return { refundPaymentIds: [] as string[] };
    }
    if (payment.status !== TransactionStatus.PENDING
      && payment.status !== TransactionStatus.FAILED) {
      return { refundPaymentIds: [] as string[] };
    }
    const claimed = await tx.paymentTransaction.updateMany({
      where: {
        id: payment.id,
        status: { in: [TransactionStatus.PENDING, TransactionStatus.FAILED] },
      },
      data: {
        status: TransactionStatus.PAID,
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
      },
    });
    if (claimed.count !== 1) return { refundPaymentIds: [] as string[] };
    const order = await tx.order.updateMany({
      where: {
        id: payment.order.id,
        patientId: payment.patientId,
        status: OrderStatus.PENDING,
        paymentExpiresAt: { gt: new Date() },
        payments: { none: { purpose: TransactionPurpose.MEDICINE_ORDER, status: TransactionStatus.PAID, id: { not: payment.id } } },
      },
      data: { status: OrderStatus.CONFIRMED },
    });
    if (order.count !== 1) throw new AppError("Order is no longer payable", 409);
    await createNotificationIfEligible({
      userId: payment.patient.userId,
      title: "Order payment successful",
      message: "Your medicine order payment was successful and the order is confirmed.",
      notificationType: NotificationType.PAYMENT,
      relatedEntityType: "Order",
      relatedEntityId: payment.order.id,
    }, tx);
    return { refundPaymentIds: [] as string[] };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  assertLateRefundRequestsSucceeded(await requestStripeRefunds(result.refundPaymentIds));
}

async function handlePaidSession(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;
  let payment = await prisma.paymentTransaction.findUnique({
    where: { providerTransactionId: session.id },
    select: { id: true, purpose: true },
  });

  // PAY-02: Gracefully reconcile and persist payment if webhook arrives before client write finished
  if (!payment && session.metadata?.patientId && session.metadata?.entityId) {
    const context = session.metadata.context;
    const patientId = session.metadata.patientId;
    const entityId = session.metadata.entityId;
    const amount = new Prisma.Decimal((session.amount_total ?? 0) / 100);

    if (context === "appointment") {
      try {
        payment = await prisma.paymentTransaction.create({
          data: {
            patientId,
            appointmentId: entityId,
            purpose: TransactionPurpose.APPOINTMENT,
            amount,
            currency: "BDT",
            status: TransactionStatus.PENDING,
            provider: "STRIPE",
            providerTransactionId: session.id,
          },
          select: { id: true, purpose: true },
        });
      } catch {
        payment = await prisma.paymentTransaction.findUnique({
          where: { providerTransactionId: session.id },
          select: { id: true, purpose: true },
        });
      }
    } else if (context === "order") {
      try {
        payment = await prisma.paymentTransaction.create({
          data: {
            patientId,
            orderId: entityId,
            purpose: TransactionPurpose.MEDICINE_ORDER,
            amount,
            currency: "BDT",
            status: TransactionStatus.PENDING,
            provider: "STRIPE",
            providerTransactionId: session.id,
          },
          select: { id: true, purpose: true },
        });
      } catch {
        payment = await prisma.paymentTransaction.findUnique({
          where: { providerTransactionId: session.id },
          select: { id: true, purpose: true },
        });
      }
    }
  }

  if (!payment) throw new AppError("Stripe checkout session is not registered", 400);
  if (payment.purpose === TransactionPurpose.APPOINTMENT) {
    await completeAppointment(session, payment.id);
  } else if (payment.purpose === TransactionPurpose.MEDICINE_ORDER) {
    await completeOrder(session, payment.id);
  }
}

export async function processStripeEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed"
    || event.type === "checkout.session.async_payment_succeeded") {
    await handlePaidSession(event.data.object);
  } else if (event.type === "checkout.session.expired"
    || event.type === "checkout.session.async_payment_failed") {
    await markUnsuccessful(event.data.object);
  } else if (event.type === "refund.created"
    || event.type === "refund.updated"
    || event.type === "refund.failed") {
    await reconcileStripeRefund(event.data.object);
  }
}

export const paymentWebhookService = { verifyStripeEvent, processStripeEvent };
