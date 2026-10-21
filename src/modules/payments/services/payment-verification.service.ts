import Stripe from "stripe";

import {
  AccountStatus,
  AppointmentStatus,
  DoctorApprovalStatus,
  OrderStatus,
  Prisma,
  Role,
  TransactionPurpose,
  TransactionStatus,
} from "../../../generated/prisma/client.js";
import { env } from "../../../config/env.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { isOrderPaymentExpired } from "../../orders/services/order-payment.rules.js";
import { buildCheckoutRedirects, toStripeMinorUnits } from "./stripe-payment.rules.js";

let stripeClient: Stripe | undefined;

const stripe = () => {
  if (!env.STRIPE_SECRET_KEY) throw new AppError("Stripe Checkout is not configured", 503);
  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
};

async function activePatient(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: Role.PATIENT, status: AccountStatus.ACTIVE, deletedAt: null },
    select: { patientProfile: { select: { id: true } } },
  });
  if (!user?.patientProfile) throw new AppError("Active patient profile required", 403);
  return user.patientProfile;
}

async function persistPendingPayment(input: {
  patientId: string;
  appointmentId?: string;
  orderId?: string;
  purpose: TransactionPurpose;
  amount: Prisma.Decimal;
  sessionId: string;
}) {
  try {
    return await prisma.paymentTransaction.create({
      data: {
        patientId: input.patientId,
        appointmentId: input.appointmentId,
        orderId: input.orderId,
        purpose: input.purpose,
        amount: input.amount,
        currency: "BDT",
        status: TransactionStatus.PENDING,
        provider: "STRIPE",
        providerTransactionId: input.sessionId,
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.paymentTransaction.findUniqueOrThrow({
        where: { providerTransactionId: input.sessionId },
        select: { id: true },
      });
    }
    throw error;
  }
}

async function reusableCheckout(where: Prisma.PaymentTransactionWhereInput) {
  const pending = await prisma.paymentTransaction.findFirst({
    where: { ...where, provider: "STRIPE", status: TransactionStatus.PENDING },
    orderBy: { createdAt: "desc" },
    select: { id: true, providerTransactionId: true },
  });
  if (!pending?.providerTransactionId) return null;
  const session = await stripe().checkout.sessions.retrieve(pending.providerTransactionId);
  if (session.status === "open" && session.url) {
    return { checkoutUrl: session.url, sessionId: session.id };
  }
  if (session.status === "expired") {
    await prisma.paymentTransaction.updateMany({
      where: { id: pending.id, status: TransactionStatus.PENDING },
      data: { status: TransactionStatus.FAILED },
    });
    return null;
  }
  throw new AppError("Payment confirmation is being processed", 409);
}

export async function createAppointmentCheckout(userId: string, appointmentId: string) {
  const patient = await activePatient(userId);
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patientId: patient.id },
    select: {
      id: true,
      status: true,
      doctor: { select: { approvalStatus: true, consultationFee: true } },
      payments: {
        where: { purpose: TransactionPurpose.APPOINTMENT, status: TransactionStatus.PAID },
        select: { id: true }, take: 1,
      },
    },
  });
  if (!appointment) throw new AppError("Appointment not found", 404);
  if (appointment.status !== AppointmentStatus.PENDING
    || appointment.doctor.approvalStatus !== DoctorApprovalStatus.APPROVED
    || appointment.payments.length > 0) {
    throw new AppError("Appointment is not eligible for payment", 409);
  }

  const reusable = await reusableCheckout({
    appointmentId: appointment.id,
    purpose: TransactionPurpose.APPOINTMENT,
  });
  if (reusable) return reusable;
  const attempt = await prisma.paymentTransaction.count({
    where: { appointmentId: appointment.id, purpose: TransactionPurpose.APPOINTMENT, provider: "STRIPE" },
  });

  const redirects = buildCheckoutRedirects(env.CLIENT_URL, "appointment", appointment.id);
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    success_url: redirects.successUrl,
    cancel_url: redirects.cancelUrl,
    client_reference_id: appointment.id,
    metadata: { context: "appointment", entityId: appointment.id, patientId: patient.id },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "bdt",
        unit_amount: toStripeMinorUnits(appointment.doctor.consultationFee),
        product_data: { name: "Doctor appointment" },
      },
    }],
  }, { idempotencyKey: `appointment-checkout-${appointment.id}-${attempt}` });
  if (!session.url) throw new AppError("Stripe did not return a checkout URL", 502);
  await persistPendingPayment({
    patientId: patient.id,
    appointmentId: appointment.id,
    purpose: TransactionPurpose.APPOINTMENT,
    amount: appointment.doctor.consultationFee,
    sessionId: session.id,
  });
  return { checkoutUrl: session.url, sessionId: session.id };
}

export async function createOrderCheckout(userId: string, orderId: string) {
  const patient = await activePatient(userId);
  const order = await prisma.order.findFirst({
    where: { id: orderId, patientId: patient.id },
    select: {
      id: true, status: true, totalAmount: true, paymentExpiresAt: true,
      payments: {
        where: { purpose: TransactionPurpose.MEDICINE_ORDER, status: TransactionStatus.PAID },
        select: { id: true }, take: 1,
      },
    },
  });
  if (!order) throw new AppError("Order not found", 404);
  if (order.status !== OrderStatus.PENDING || order.payments.length > 0
    || isOrderPaymentExpired(order.paymentExpiresAt)) {
    throw new AppError("Order is not eligible for payment", 409);
  }


  const reusable = await reusableCheckout({
    orderId: order.id,
    purpose: TransactionPurpose.MEDICINE_ORDER,
  });
  if (reusable) return reusable;
  const attempt = await prisma.paymentTransaction.count({
    where: { orderId: order.id, purpose: TransactionPurpose.MEDICINE_ORDER, provider: "STRIPE" },
  });

  const redirects = buildCheckoutRedirects(env.CLIENT_URL, "order", order.id);
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    success_url: redirects.successUrl,
    cancel_url: redirects.cancelUrl,
    client_reference_id: order.id,
    metadata: { context: "order", entityId: order.id, patientId: patient.id },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "bdt",
        unit_amount: toStripeMinorUnits(order.totalAmount),
        product_data: { name: "Medicine order" },
      },
    }],
  }, { idempotencyKey: `order-checkout-${order.id}-${attempt}` });
  if (!session.url) throw new AppError("Stripe did not return a checkout URL", 502);
  await persistPendingPayment({
    patientId: patient.id,
    orderId: order.id,
    purpose: TransactionPurpose.MEDICINE_ORDER,
    amount: order.totalAmount,
    sessionId: session.id,
  });
  return { checkoutUrl: session.url, sessionId: session.id };
}

export const paymentVerificationService = { createAppointmentCheckout, createOrderCheckout };
