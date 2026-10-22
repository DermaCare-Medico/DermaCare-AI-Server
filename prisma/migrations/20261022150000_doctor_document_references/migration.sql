ALTER TABLE "doctor_profiles"
ADD COLUMN "document_references" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
