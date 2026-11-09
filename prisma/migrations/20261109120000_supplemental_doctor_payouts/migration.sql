ALTER TABLE "doctor_payouts"
  ADD COLUMN "payout_sequence" INTEGER NOT NULL DEFAULT 1;

DROP INDEX "doctor_payouts_doctor_id_period_start_period_end_key";

CREATE UNIQUE INDEX "doctor_payouts_doctor_id_period_start_period_end_payout_sequence_key"
  ON "doctor_payouts"("doctor_id", "period_start", "period_end", "payout_sequence");
