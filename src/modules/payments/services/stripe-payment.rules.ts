import { Prisma } from "../../../generated/prisma/client.js";

export type CheckoutContext = "appointment" | "order";

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
  cancel.searchParams.set("context", context);
  cancel.searchParams.set(`${context}Id`, entityId);
  return { successUrl: success.toString(), cancelUrl: cancel.toString() };
};

export const stripePaymentMatches = (
  expectedAmount: Prisma.Decimal,
  expectedCurrency: string,
  amountTotal: number | null,
  currency: string | null,
) => amountTotal === toStripeMinorUnits(expectedAmount)
  && currency?.toUpperCase() === expectedCurrency.toUpperCase();
