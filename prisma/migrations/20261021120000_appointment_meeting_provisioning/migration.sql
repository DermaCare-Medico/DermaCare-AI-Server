CREATE TYPE "meeting_provisioning_status" AS ENUM ('NOT_REQUESTED', 'PENDING', 'PROCESSING', 'READY', 'FAILED');

ALTER TABLE "appointments"
ADD COLUMN "google_calendar_event_id" TEXT,
ADD COLUMN "meeting_provisioning_status" "meeting_provisioning_status" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN "meeting_provisioning_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "meeting_provisioning_next_attempt_at" TIMESTAMP(6),
ADD COLUMN "meeting_provisioning_locked_at" TIMESTAMP(6),
ADD COLUMN "meeting_provisioning_error" VARCHAR(500);

CREATE UNIQUE INDEX "appointments_google_calendar_event_id_key" ON "appointments"("google_calendar_event_id");
CREATE INDEX "appointments_meeting_provisioning_status_meeting_provisioning_next_attempt_at_idx"
ON "appointments"("meeting_provisioning_status", "meeting_provisioning_next_attempt_at");
