-- Migration: add soft-delete support (#654)
-- Adds nullable deletedAt to the most commonly deleted entities.
-- Queries should filter WHERE "deletedAt" IS NULL to exclude soft-deleted rows.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Artist" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Commission" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Portfolio" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Index to make "active record" queries fast
CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX IF NOT EXISTS "Artist_deletedAt_idx" ON "Artist"("deletedAt");
CREATE INDEX IF NOT EXISTS "Service_deletedAt_idx" ON "Service"("deletedAt");
CREATE INDEX IF NOT EXISTS "Commission_deletedAt_idx" ON "Commission"("deletedAt");
