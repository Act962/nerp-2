-- CreateEnum
CREATE TYPE "SpaceTier" AS ENUM ('PREMIUM', 'OURO', 'PRATA', 'BRONZE');

-- CreateEnum
CREATE TYPE "SpaceFlowLevel" AS ENUM ('MUITO_ALTO', 'ALTO', 'MEDIO', 'BAIXO');

-- CreateEnum
CREATE TYPE "SpaceVisibility" AS ENUM ('EXCELENTE', 'BOA', 'REGULAR');

-- AlterTable
ALTER TABLE "map_objects" ADD COLUMN     "avgSalesAmount" DECIMAL(12,2),
ADD COLUMN     "flowLevel" "SpaceFlowLevel",
ADD COLUMN     "isExclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mediaTypeId" TEXT,
ADD COLUMN     "revenuePotential" DECIMAL(12,2),
ADD COLUMN     "sectorId" TEXT,
ADD COLUMN     "tier" "SpaceTier",
ADD COLUMN     "visibility" "SpaceVisibility";

-- AlterTable
ALTER TABLE "media_types" ADD COLUMN     "defaultPhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "occupancyRules" TEXT;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "areaM2" DOUBLE PRECISION,
ADD COLUMN     "customersPerDay" INTEGER,
ADD COLUMN     "monthlyCost" DECIMAL(12,2);

-- CreateIndex
CREATE INDEX "map_objects_organizationId_mediaTypeId_idx" ON "map_objects"("organizationId", "mediaTypeId");

-- CreateIndex
CREATE INDEX "map_objects_organizationId_sectorId_idx" ON "map_objects"("organizationId", "sectorId");

-- AddForeignKey
ALTER TABLE "map_objects" ADD CONSTRAINT "map_objects_mediaTypeId_fkey" FOREIGN KEY ("mediaTypeId") REFERENCES "media_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_objects" ADD CONSTRAINT "map_objects_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "store_sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
