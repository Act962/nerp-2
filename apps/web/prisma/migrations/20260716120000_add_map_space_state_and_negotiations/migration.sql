-- CreateEnum
CREATE TYPE "MapSpaceState" AS ENUM ('LIVRE', 'EXECUTADO', 'PENDENTE');

-- CreateEnum
CREATE TYPE "NegotiationStatus" AS ENUM ('RASCUNHO', 'PROPOSTA', 'FECHADA', 'CANCELADA');

-- AlterTable
ALTER TABLE "map_objects" ADD COLUMN     "spaceCode" TEXT,
ADD COLUMN     "spaceSeq" INTEGER,
ADD COLUMN     "spaceState" "MapSpaceState" NOT NULL DEFAULT 'LIVRE';

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "sigla" TEXT;

-- CreateTable
CREATE TABLE "space_negotiations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mapObjectId" TEXT NOT NULL,
    "supplierId" TEXT,
    "brandId" TEXT,
    "distributor" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "amount" DECIMAL(12,2),
    "status" "NegotiationStatus" NOT NULL DEFAULT 'RASCUNHO',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_negotiations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "space_negotiations_organizationId_idx" ON "space_negotiations"("organizationId");

-- CreateIndex
CREATE INDEX "space_negotiations_mapObjectId_createdAt_idx" ON "space_negotiations"("mapObjectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "space_negotiations_organizationId_endDate_idx" ON "space_negotiations"("organizationId", "endDate");

-- CreateIndex
CREATE INDEX "map_objects_organizationId_spaceState_idx" ON "map_objects"("organizationId", "spaceState");

-- CreateIndex
CREATE UNIQUE INDEX "map_objects_organizationId_spaceCode_key" ON "map_objects"("organizationId", "spaceCode");

-- AddForeignKey
ALTER TABLE "space_negotiations" ADD CONSTRAINT "space_negotiations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_negotiations" ADD CONSTRAINT "space_negotiations_mapObjectId_fkey" FOREIGN KEY ("mapObjectId") REFERENCES "map_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_negotiations" ADD CONSTRAINT "space_negotiations_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_negotiations" ADD CONSTRAINT "space_negotiations_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_negotiations" ADD CONSTRAINT "space_negotiations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

