ALTER TABLE "doctor_payouts"
  ADD COLUMN "stripe_payment_intent_id" VARCHAR(255),
  ADD COLUMN "paid_by_admin_id" UUID;

CREATE UNIQUE INDEX "doctor_payouts_stripe_payment_intent_id_key"
  ON "doctor_payouts"("stripe_payment_intent_id");

ALTER TABLE "doctor_payouts"
  ADD CONSTRAINT "doctor_payouts_paid_by_admin_id_fkey"
  FOREIGN KEY ("paid_by_admin_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
