-- Issue #1405: soft delete for Clip model.
-- deletedAt marks a clip as deleted without removing the row, preserving
-- earnings/audit history. The index supports the default `deletedAt: null`
-- filter and the purge job that hard-deletes rows older than 90 days.
ALTER TABLE "Clip"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Clip_deletedAt_idx" ON "Clip"("deletedAt");
