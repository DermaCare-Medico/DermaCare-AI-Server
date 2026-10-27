-- Add missing patient-provided location and the exact successful-analysis timestamp.
-- Both columns are nullable so existing screening records remain valid.
ALTER TABLE "screenings"
ADD COLUMN "body_area" VARCHAR(100),
ADD COLUMN "completed_at" TIMESTAMP(6);
