-- DropForeignKey
ALTER TABLE "conditions" DROP CONSTRAINT "conditions_specialization_id_fkey";

-- DropForeignKey
ALTER TABLE "doctor_profiles" DROP CONSTRAINT "doctor_profiles_specialization_id_fkey";

-- CreateTable
CREATE TABLE "doctor_specializations" (
    "doctor_id" UUID NOT NULL,
    "specialization_id" UUID NOT NULL,

    CONSTRAINT "doctor_specializations_pkey" PRIMARY KEY ("doctor_id","specialization_id")
);

-- CreateTable
CREATE TABLE "condition_specializations" (
    "condition_id" UUID NOT NULL,
    "specialization_id" UUID NOT NULL,

    CONSTRAINT "condition_specializations_pkey" PRIMARY KEY ("condition_id","specialization_id")
);

-- CreateIndex
CREATE INDEX "doctor_specializations_specialization_id_idx" ON "doctor_specializations"("specialization_id");

-- CreateIndex
CREATE INDEX "condition_specializations_specialization_id_idx" ON "condition_specializations"("specialization_id");

-- AddForeignKey
ALTER TABLE "doctor_specializations" ADD CONSTRAINT "doctor_specializations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_specializations" ADD CONSTRAINT "doctor_specializations_specialization_id_fkey" FOREIGN KEY ("specialization_id") REFERENCES "specializations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_specializations" ADD CONSTRAINT "condition_specializations_condition_id_fkey" FOREIGN KEY ("condition_id") REFERENCES "conditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_specializations" ADD CONSTRAINT "condition_specializations_specialization_id_fkey" FOREIGN KEY ("specialization_id") REFERENCES "specializations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "appointments_meeting_provisioning_status_meeting_provisioning_n" RENAME TO "appointments_meeting_provisioning_status_meeting_provisioni_idx";
