-- CreateEnum
CREATE TYPE "StoreGeoSource" AS ENUM ('FOTO', 'MANUAL', 'IMPORTED', 'GEOCODED');
CREATE TYPE "StoreGeoStatus" AS ENUM ('PENDING', 'QUEUED', 'OK', 'NOT_FOUND', 'FAILED');

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "latitude" DOUBLE PRECISION,
                     ADD COLUMN     "longitude" DOUBLE PRECISION,
                     ADD COLUMN     "geoSource" "StoreGeoSource",
                     ADD COLUMN     "geoStatus" "StoreGeoStatus" NOT NULL DEFAULT 'PENDING',
                     ADD COLUMN     "geoSampleCount" INTEGER NOT NULL DEFAULT 0,
                     ADD COLUMN     "geoPrecision" TEXT,
                     ADD COLUMN     "geoQuery" TEXT,
                     ADD COLUMN     "geoUpdatedAt" TIMESTAMP(3),
                     ADD COLUMN     "geoError" TEXT;

-- AlterTable
ALTER TABLE "pdv_photos" ADD COLUMN     "capturedAddress" TEXT;

-- CreateIndex
CREATE INDEX "stores_organizationId_geoStatus_idx" ON "stores"("organizationId", "geoStatus");

-- CreateIndex
-- Índices do trajeto. O `(organizationId, createdById)` existente vira prefixo
-- do primeiro e sai numa migração seguinte, para não misturar risco.
CREATE INDEX "pdv_photos_organizationId_createdById_capturedAt_idx" ON "pdv_photos"("organizationId", "createdById", "capturedAt");
CREATE INDEX "pdv_photos_organizationId_capturedAt_idx" ON "pdv_photos"("organizationId", "capturedAt");
