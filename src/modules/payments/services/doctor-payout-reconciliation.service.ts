import Stripe from "stripe";
import { NotificationType, PayoutStatus, Prisma } from "../../../generated/prisma/client.js";
import { env } from "../../../config/env.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { createNotificationIfEligible } from "../../notifications/services/notification.service.js";
import { doctorPayoutMetadataMatches, stripeDoctorPayoutMatches, toStripeMinorUnits } from "./stripe-payment.rules.js";

let stripeClient: Stripe | undefined;
const stripe = () => {
  if (!env.STRIPE_SECRET_KEY) throw new AppError("Stripe is not configured", 503);
  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
};

export async function reconcileDoctorPayout(session: Stripe.Checkout.Session): Promise<boolean> {
  if (session.payment_status !== "paid") return false;
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;
  if (!paymentIntentId) throw new AppError("Stripe PaymentIntent reference is missing", 400);

  const sessionMetadata = session.metadata;
  const payoutId = sessionMetadata?.payoutId;
  const doctorId = sessionMetadata?.doctorId;
  const adminId = sessionMetadata?.adminId;
  if (!payoutId || !doctorId || !adminId || sessionMetadata?.context !== "doctorPayout") {
    throw new AppError("Invalid doctor payout metadata", 400);
  }

  const paymentIntent = await stripe().paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== "succeeded") return false;
  if (paymentIntent.amount !== session.amount_total
    || paymentIntent.currency?.toUpperCase() !== "BDT") {
    throw new AppError("Stripe PaymentIntent does not match the doctor payout", 400);
  }
  const intentMetadata = paymentIntent.metadata;
  if (!doctorPayoutMetadataMatches(intentMetadata, { payoutId, doctorId, adminId })) {
    throw new AppError("Stripe PaymentIntent metadata does not match the payout", 400);
  }

  await prisma.$transaction(async (tx) => {
    const payout = await tx.doctorPayout.findUnique({
      where: { id: payoutId },
      select: {
        id: true, doctorId: true, netAmount: true, status: true, transactionReference: true,
        doctor: { select: { userId: true } },
      },
    });
    if (!payout || !stripeDoctorPayoutMatches({
      id: payout.id,
      doctorId: payout.doctorId,
      amount: payout.netAmount,
      sessionId: payout.transactionReference ?? "",
    }, {
      id: session.id,
      clientReferenceId: session.client_reference_id,
      context: sessionMetadata.context,
      payoutId,
      doctorId,
      amountTotal: session.amount_total,
      currency: session.currency,
    }) || payout.doctorId !== doctorId
      || session.amount_total !== toStripeMinorUnits(payout.netAmount)) {
      throw new AppError("Stripe payment details do not match the doctor payout", 400);
    }
    if (payout.status === PayoutStatus.PAID) return;
    if (payout.status !== PayoutStatus.PROCESSING) {
      throw new AppError("Doctor payout is not awaiting payment", 409);
    }
    const paidAt = new Date();
    const claimed = await tx.doctorPayout.updateMany({
      where: { id: payout.id, status: PayoutStatus.PROCESSING, transactionReference: session.id },
      data: { status: PayoutStatus.PAID, paidAt, stripePaymentIntentId: paymentIntentId, paidByAdminId: adminId },
    });
    if (claimed.count !== 1) return;
    await tx.auditLog.create({
      data: {
        actorUserId: adminId,
        action: "DOCTOR_PAYOUT_PAID_BY_STRIPE",
        entityType: "DoctorPayout",
        entityId: payout.id,
        before: { status: PayoutStatus.PROCESSING },
        after: { status: PayoutStatus.PAID, paidAt },
      },
    });
    await createNotificationIfEligible({
      userId: payout.doctor.userId,
      title: "Doctor payout successful",
      message: "TEST PAYOUT recorded successfully. No funds were disbursed to a doctor account.",
      notificationType: NotificationType.PAYMENT,
      relatedEntityType: "DoctorPayout",
      relatedEntityId: payout.id,
    }, tx);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return true;
}
