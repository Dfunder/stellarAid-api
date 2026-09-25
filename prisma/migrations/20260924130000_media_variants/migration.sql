-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "variantOfId" TEXT,
ADD COLUMN     "variantLabel" TEXT;

-- CreateIndex
CREATE INDEX "Media_variantOfId_idx" ON "Media"("variantOfId");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_variantOfId_fkey" FOREIGN KEY ("variantOfId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
