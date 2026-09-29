-- CreateEnum
CREATE TYPE "CommissionDisputeStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CommissionDispute" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "status" "CommissionDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionDispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionDispute_commissionId_key" ON "CommissionDispute"("commissionId");

-- CreateIndex
CREATE INDEX "CommissionDispute_status_idx" ON "CommissionDispute"("status");

-- CreateIndex
CREATE INDEX "CommissionDispute_raisedById_idx" ON "CommissionDispute"("raisedById");

-- AddForeignKey
ALTER TABLE "CommissionDispute" ADD CONSTRAINT "CommissionDispute_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
