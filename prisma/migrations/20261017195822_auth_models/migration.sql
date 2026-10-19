/*
  Warnings:

  - You are about to drop the column `user_id` on the `otp_codes` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "otp_codes" DROP CONSTRAINT "otp_codes_user_id_fkey";

-- DropIndex
DROP INDEX "otp_codes_email_purpose_expires_at_idx";

-- DropIndex
DROP INDEX "otp_codes_user_id_idx";

-- AlterTable
ALTER TABLE "otp_codes" DROP COLUMN "user_id",
ADD COLUMN     "payload" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "consent_version" VARCHAR(20),
ADD COLUMN     "health_consent_accepted_at" TIMESTAMP(6),
ADD COLUMN     "privacy_accepted_at" TIMESTAMP(6),
ADD COLUMN     "terms_accepted_at" TIMESTAMP(6);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "revoked_at" TIMESTAMP(6),
    "user_agent" TEXT,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "otp_codes_email_purpose_created_at_idx" ON "otp_codes"("email", "purpose", "created_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
