-- Preserve legacy one-to-many specialization assignments. ON CONFLICT makes
-- this safe when rows were already copied manually or by a previous repair.
INSERT INTO "doctor_specializations" ("doctor_id", "specialization_id")
SELECT "id", "specialization_id"
FROM "doctor_profiles"
WHERE "specialization_id" IS NOT NULL
ON CONFLICT ("doctor_id", "specialization_id") DO NOTHING;

INSERT INTO "condition_specializations" ("condition_id", "specialization_id")
SELECT "id", "specialization_id"
FROM "conditions"
WHERE "specialization_id" IS NOT NULL
ON CONFLICT ("condition_id", "specialization_id") DO NOTHING;

-- Remove the compatibility index only when the historical rename moved it to
-- the target name. Never drop a real composite index at the target name.
DO $$
DECLARE
    target_definition TEXT;
BEGIN
    SELECT pg_get_indexdef(to_regclass(
        'appointments_meeting_provisioning_status_meeting_provisioni_idx'
    )) INTO target_definition;

    IF target_definition IS NOT NULL
       AND target_definition LIKE '% USING btree (id)' THEN
        DROP INDEX "appointments_meeting_provisioning_status_meeting_provisioni_idx";
    END IF;
END
$$;

-- Create the canonical index before removing PostgreSQL's truncated source
-- name. This covers fresh installs and databases with either historical name.
CREATE INDEX IF NOT EXISTS "appointments_meeting_provisioning_status_meeting_provisioni_idx"
ON "appointments"("meeting_provisioning_status", "meeting_provisioning_next_attempt_at");

DROP INDEX IF EXISTS "appointments_meeting_provisioning_status_meeting_provisioning_n";
