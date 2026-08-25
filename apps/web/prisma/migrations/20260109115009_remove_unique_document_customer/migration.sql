-- DropIndex
DROP INDEX "customers_organizationId_document_key";

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "document" DROP NOT NULL;
