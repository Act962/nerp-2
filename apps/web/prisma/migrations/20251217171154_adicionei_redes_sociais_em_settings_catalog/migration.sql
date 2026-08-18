-- CreateEnum
CREATE TYPE "CatalogSortOrder" AS ENUM ('ASC', 'DESC', 'NEWEST', 'OLDEST');

-- AlterTable
ALTER TABLE "catalog_settings" ADD COLUMN     "kwai" TEXT,
ADD COLUMN     "sortOrder" "CatalogSortOrder" NOT NULL DEFAULT 'ASC',
ADD COLUMN     "tiktok" TEXT,
ADD COLUMN     "twitter" TEXT,
ADD COLUMN     "youtube" TEXT;
