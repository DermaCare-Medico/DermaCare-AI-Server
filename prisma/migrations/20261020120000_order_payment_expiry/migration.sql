-- Add a fixed payment reservation deadline to medicine orders.
ALTER TABLE "orders"
ADD COLUMN "payment_expires_at" TIMESTAMP(6);

UPDATE "orders"
SET "payment_expires_at" = "created_at" + INTERVAL '30 minutes'
WHERE "payment_expires_at" IS NULL;

ALTER TABLE "orders"
ALTER COLUMN "payment_expires_at" SET NOT NULL;

CREATE INDEX "orders_status_payment_expires_at_idx"
ON "orders"("status", "payment_expires_at");
