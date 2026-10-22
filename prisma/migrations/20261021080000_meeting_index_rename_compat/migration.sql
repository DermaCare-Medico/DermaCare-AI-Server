-- Compatibility shim for fresh installs.
--
-- The following historical migration renames this 63-character index name,
-- while the migration that creates the real meeting-provisioning index sorts
-- later.  A disposable index lets that historical rename succeed without
-- changing an already-applied migration.  The forward corrective migration
-- replaces this shim with the real composite index.
CREATE INDEX IF NOT EXISTS "appointments_meeting_provisioning_status_meeting_provisioning_n"
ON "appointments"("id");
