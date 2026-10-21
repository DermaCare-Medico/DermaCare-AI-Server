-- Strength is nullable so existing medicines and order snapshots remain valid.
ALTER TABLE "medicines"
ADD COLUMN "strength" VARCHAR(100);

ALTER TABLE "order_items"
ADD COLUMN "medicine_strength" VARCHAR(100);
