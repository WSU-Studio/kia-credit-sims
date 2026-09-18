-- AlterTable
ALTER TABLE "dealer_promotions" ADD COLUMN "manufYear" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "dealer_promotions" ADD COLUMN "fscCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "dealer_promotions" ADD COLUMN "trimName" TEXT;
ALTER TABLE "dealer_promotions" ADD COLUMN "variantOtr" DOUBLE PRECISION;

-- DropIndex
DROP INDEX "dealer_promotions_vendorCode_assetCode_key";

-- CreateIndex
CREATE INDEX "dealer_promotions_vendorCode_assetCode_idx" ON "dealer_promotions"("vendorCode", "assetCode");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_promotions_vendorCode_assetCode_manufYear_fscCode_key" ON "dealer_promotions"("vendorCode", "assetCode", "manufYear", "fscCode");
