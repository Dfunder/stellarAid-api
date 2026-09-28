-- AlterTable
ALTER TABLE "ReviewReport" ADD COLUMN IF NOT EXISTS "note" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReviewReport_reporterId_createdAt_idx" ON "ReviewReport"("reporterId", "createdAt");
