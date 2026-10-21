-- Durable Stripe refund tracking. TransactionStatus remains PAID until Stripe
-- confirms that funds were actually returned.
CREATE TYPE "refund_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

ALTER TABLE "payment_transactions"
ADD COLUMN "stripe_payment_intent_id" VARCHAR(255),
ADD COLUMN "stripe_charge_id" VARCHAR(255),
ADD COLUMN "stripe_refund_id" VARCHAR(255),
ADD COLUMN "refund_status" "refund_status",
ADD COLUMN "refund_error" VARCHAR(500),
ADD COLUMN "refunded_at" TIMESTAMP(6);

CREATE UNIQUE INDEX "payment_transactions_stripe_payment_intent_id_key"
ON "payment_transactions"("stripe_payment_intent_id");

CREATE UNIQUE INDEX "payment_transactions_stripe_refund_id_key"
ON "payment_transactions"("stripe_refund_id");

CREATE INDEX "payment_transactions_refund_status_idx"
ON "payment_transactions"("refund_status");
