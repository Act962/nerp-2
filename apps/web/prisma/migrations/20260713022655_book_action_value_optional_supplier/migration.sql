-- DropForeignKey
ALTER TABLE "books" DROP CONSTRAINT "books_supplierId_fkey";

-- AlterTable
ALTER TABLE "books" ALTER COLUMN "supplierId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "pdv_photos" ADD COLUMN     "actionValue" DECIMAL(10,2);

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
