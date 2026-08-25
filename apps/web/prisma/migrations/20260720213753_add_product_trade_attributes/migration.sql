-- DropForeignKey
ALTER TABLE "brands" DROP CONSTRAINT "brands_supplierId_fkey";

-- DropIndex
DROP INDEX "products_barcode_idx";

-- AlterTable
ALTER TABLE "brands" ALTER COLUMN "supplierId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "path" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "brandId" TEXT,
ADD COLUMN     "depthMm" INTEGER,
ADD COLUMN     "grossWeightG" INTEGER,
ADD COLUMN     "heightMm" INTEGER,
ADD COLUMN     "ncm" TEXT,
ADD COLUMN     "packDepthMm" INTEGER,
ADD COLUMN     "packHeightMm" INTEGER,
ADD COLUMN     "packQty" INTEGER,
ADD COLUMN     "packWidthMm" INTEGER,
ADD COLUMN     "widthMm" INTEGER,
ALTER COLUMN "thumbnail" SET DEFAULT '';

-- CreateIndex
CREATE INDEX "categories_organizationId_level_idx" ON "categories"("organizationId", "level");

-- CreateIndex
CREATE INDEX "categories_organizationId_path_idx" ON "categories"("organizationId", "path");

-- CreateIndex
CREATE INDEX "products_organizationId_barcode_idx" ON "products"("organizationId", "barcode");

-- CreateIndex
CREATE INDEX "products_organizationId_brandId_idx" ON "products"("organizationId", "brandId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
