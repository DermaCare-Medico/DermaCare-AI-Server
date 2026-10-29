import { Prisma } from "../../../generated/prisma/client.js";

export type CheckoutContext = "appointment" | "order" | "doctorPayout";

export const toStripeMinorUnits = (amount: Prisma.Decimal) => {
  const minor = amount.mul(100);
  if (!minor.isInteger() || minor.lessThanOrEqualTo(0)) {
    throw new Error("Payment amount cannot be represented in Stripe minor units");
  }
  return minor.toNumber();
};

export const buildCheckoutRedirects = (
  clientUrl: string,
  context: CheckoutContext,
  entityId: string,
) => {
  const success = new URL("/payments/success", clientUrl);
  success.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  success.searchParams.set("context", context);
  success.searchParams.set(`${context}Id`, entityId);

  const cancel = new URL("/payments/cancel", clientUrl);
  cancel.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  cancel.searchParams.set("context", context);
  cancel.searchParams.set(`${context}Id`, entityId);
  const preserveStripePlaceholder = (url: URL) => url.toString()
    .replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}");

  return {
    successUrl: preserveStripePlaceholder(success),
    cancelUrl: preserveStripePlaceholder(cancel),
  };
};

export const buildOrderCheckoutRedirects = (
  clientUrl: string,
  orderId: string,
) => {
  const orderPath = `/patient/orders/${encodeURIComponent(orderId)}`;
  const success = new URL(orderPath, clientUrl);
  success.searchParams.set("payment", "success");
  success.searchParams.set("context", "order");
  success.searchParams.set("orderId", orderId);
  success.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

  const cancel = new URL(orderPath, clientUrl);
  cancel.searchParams.set("payment", "cancelled");
  cancel.searchParams.set("context", "order");
  cancel.searchParams.set("orderId", orderId);

  return {
    successUrl: success.toString()
      .replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}"),
    cancelUrl: cancel.toString(),
  };
};

export const stripePaymentMatches = (
  expectedAmount: Prisma.Decimal,
  expectedCurrency: string,
  amountTotal: number | null,
  currency: string | null,
) => amountTotal === toStripeMinorUnits(expectedAmount)
  && currency?.toUpperCase() === expectedCurrency.toUpperCase();

export const stripeOrderPaymentMatches = (
  order: { id: string; patientId: string; totalAmount: Prisma.Decimal },
  payment: { orderId: string; patientId: string; amount: Prisma.Decimal; currency: string },
  checkout: {
    context?: string;
    entityId?: string;
    patientId?: string;
    clientReferenceId: string | null;
    amountTotal: number | null;
    currency: string | null;
  },
) => checkout.context === "order"
  && checkout.entityId === order.id
  && checkout.clientReferenceId === order.id
  && checkout.patientId === payment.patientId
  && payment.orderId === order.id
  && order.patientId === payment.patientId
  && payment.amount.equals(order.totalAmount)
  && stripePaymentMatches(payment.amount, payment.currency, checkout.amountTotal, checkout.currency);

export const paymentCompletedBeforeDeadline = (
  paidAt: Date,
  deadline: Date | null,
) => !deadline || paidAt <= deadline;

export const doctorPayoutCheckoutIdempotencyKey = (payoutId: string, priorSessionId?: string | null) =>
  `doctor-payout-checkout-${payoutId}-${priorSessionId ?? "initial"}`;

export const stripeDoctorPayoutMatches = (
  payout: { id: string; doctorId: string; amount: Prisma.Decimal; sessionId: string },
  checkout: {
    id: string;
    clientReferenceId: string | null;
    context?: string;
    payoutId?: string;
    doctorId?: string;
    amountTotal: number | null;
    currency: string | null;
  },
) => checkout.context === "doctorPayout"
  && checkout.id === payout.sessionId
  && checkout.clientReferenceId === payout.id
  && checkout.payoutId === payout.id
  && checkout.doctorId === payout.doctorId
  && stripePaymentMatches(payout.amount, "BDT", checkout.amountTotal, checkout.currency);
