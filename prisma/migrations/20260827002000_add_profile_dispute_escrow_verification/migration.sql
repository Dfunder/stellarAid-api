-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'APPEALED', 'CLOSED');
CREATE TYPE "DisputeResolution" AS ENUM ('NONE', 'REFUND_CLIENT', 'RELEASE_ARTIST', 'SPLIT');
CREATE TYPE "EscrowStatus" AS ENUM ('HELD', 'RELEASED', 'REFUNDED', 'DISPUTED', 'PARTIALLY_RELEASED');
CREATE TYPE "VerificationType" AS ENUM ('EMAIL', 'IDENTITY', 'PORTFOLIO');
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- Profile management fields (#599) and trust score (#602)
ALTER TABLE "Artist" ADD COLUMN "socialLinks" JSONB;
ALTER TABLE "Artist" ADD COLUMN "isProfilePublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Artist" ADD COLUMN "trustScore" INTEGER NOT NULL DEFAULT 0;

-- Dispute resolution (#600)
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "filedById" TEXT NOT NULL,
    "againstId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" "DisputeResolution" NOT NULL DEFAULT 'NONE',
    "resolutionNote" TEXT,
    "evidence" TEXT[],
    "reviewedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "appealNote" TEXT,
    "appealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Dispute_commissionId_idx" ON "Dispute"("commissionId");
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrow management (#601)
CREATE TABLE "Escrow" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "amountUsdc" DECIMAL(65,30) NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'HELD',
    "txHash" TEXT,
    "heldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Escrow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Escrow_commissionId_idx" ON "Escrow"("commissionId");
CREATE INDEX "Escrow_status_idx" ON "Escrow"("status");
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EscrowEvent" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EscrowEvent_escrowId_idx" ON "EscrowEvent"("escrowId");
ALTER TABLE "EscrowEvent" ADD CONSTRAINT "EscrowEvent_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "Escrow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reputation & verification (#602)
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "evidence" TEXT[],
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VerificationRequest_artistId_type_idx" ON "VerificationRequest"("artistId", "type");
CREATE INDEX "VerificationRequest_status_idx" ON "VerificationRequest"("status");
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
