-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "price" DECIMAL(12,2),
ADD COLUMN     "asset" "Asset";

-- CreateIndex
CREATE INDEX "Artwork_price_idx" ON "Artwork"("price");
