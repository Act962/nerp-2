-- CreateEnum
CREATE TYPE "CatalogOperationMode" AS ENUM ('MARKETPLACE', 'KITCHEN');

-- AlterTable
ALTER TABLE "catalog_settings" ADD COLUMN     "operationMode" "CatalogOperationMode" NOT NULL DEFAULT 'MARKETPLACE';
