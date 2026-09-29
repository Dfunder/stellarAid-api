-- CreateTable
CREATE TABLE "CommissionEvent" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "fromStatus" "CommissionStatus",
    "toStatus" "CommissionStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionEvent_commissionId_createdAt_idx" ON "CommissionEvent"("commissionId", "createdAt");

-- AddForeignKey
ALTER TABLE "CommissionEvent" ADD CONSTRAINT "CommissionEvent_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
