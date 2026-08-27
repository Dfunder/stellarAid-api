-- CreateEnum
CREATE TYPE "CommissionRevisionStatus" AS ENUM ('REQUESTED', 'ADDRESSED');

-- Artist location for marketplace location filtering (#604)
ALTER TABLE "Artist" ADD COLUMN "location" TEXT;

-- Commission delivery tracking (#606)
ALTER TABLE "Commission" ADD COLUMN "deliveryDueAt" TIMESTAMP(3);
ALTER TABLE "Commission" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Commission" ADD COLUMN "deliveryVerifiedAt" TIMESTAMP(3);

-- Saved searches (#603)
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");

-- Search analytics (#603)
CREATE TABLE "SearchQuery" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "userId" TEXT,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SearchQuery_term_idx" ON "SearchQuery"("term");

-- Favorites / wishlist (#605)
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "priceAtFavoriteUsdc" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Favorite_userId_serviceId_key" ON "Favorite"("userId", "serviceId");
CREATE INDEX "Favorite_serviceId_idx" ON "Favorite"("serviceId");
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Commission revisions (#606)
CREATE TABLE "CommissionRevision" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "status" "CommissionRevisionStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRevision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CommissionRevision_commissionId_idx" ON "CommissionRevision"("commissionId");
ALTER TABLE "CommissionRevision" ADD CONSTRAINT "CommissionRevision_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Commission completion checklist (#606)
CREATE TABLE "CommissionChecklistItem" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionChecklistItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CommissionChecklistItem_commissionId_idx" ON "CommissionChecklistItem"("commissionId");
ALTER TABLE "CommissionChecklistItem" ADD CONSTRAINT "CommissionChecklistItem_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
