-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CommissionEventType" AS ENUM (
    'STATUS_CHANGED',
    'DELIVERABLE_SUBMITTED',
    'DELIVERABLE_ACCEPTED',
    'CHANGES_REQUESTED',
    'CANCELLED',
    'ESCROW_RELEASED',
    'ESCROW_REFUNDED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Commission"
  ADD COLUMN IF NOT EXISTS "revisionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cancelReason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledById" TEXT,
  ADD COLUMN IF NOT EXISTS "escrowFunded" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "escrowTxHash" TEXT,
  ADD COLUMN IF NOT EXISTS "escrowReleasedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "escrowRefundedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Deliverable"
  ADD COLUMN IF NOT EXISTS "mediaIds" JSONB,
  ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "feedback" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommissionEvent" (
  "id" TEXT NOT NULL,
  "commissionId" TEXT NOT NULL,
  "type" "CommissionEventType" NOT NULL,
  "actorId" TEXT NOT NULL,
  "message" TEXT,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommissionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommissionEvent_commissionId_createdAt_idx" ON "CommissionEvent"("commissionId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommissionEvent_actorId_idx" ON "CommissionEvent"("actorId");

-- AddForeignKey
ALTER TABLE "CommissionEvent" DROP CONSTRAINT IF EXISTS "CommissionEvent_commissionId_fkey";
ALTER TABLE "CommissionEvent" ADD CONSTRAINT "CommissionEvent_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
