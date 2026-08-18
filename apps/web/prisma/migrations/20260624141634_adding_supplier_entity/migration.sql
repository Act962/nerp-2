-- DropIndex
DROP INDEX "suppliers_organizationId_document_key";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "supplierId" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "personType" "PersonType" NOT NULL DEFAULT 'JURIDICA',
ALTER COLUMN "document" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "products_supplierId_idx" ON "products"("supplierId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
