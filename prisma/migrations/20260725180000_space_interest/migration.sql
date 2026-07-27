-- CreateEnum
CREATE TYPE "SpaceInterestKind" AS ENUM ('INTERESSE', 'FILA_ESPERA');

-- CreateEnum
CREATE TYPE "SpaceInterestStatus" AS ENUM ('NOVO', 'EM_CONTATO', 'GANHO', 'ARQUIVADO');

-- CreateTable
CREATE TABLE "space_interests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "mapObjectId" TEXT,
    "kind" "SpaceInterestKind" NOT NULL,
    "status" "SpaceInterestStatus" NOT NULL DEFAULT 'NOVO',
    "spaceCode" TEXT,
    "spaceLabel" TEXT,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "space_interests_organizationId_status_idx" ON "space_interests"("organizationId", "status");

-- CreateIndex
CREATE INDEX "space_interests_storeId_idx" ON "space_interests"("storeId");

-- CreateIndex
CREATE INDEX "space_interests_mapObjectId_idx" ON "space_interests"("mapObjectId");

-- AddForeignKey
ALTER TABLE "space_interests" ADD CONSTRAINT "space_interests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_interests" ADD CONSTRAINT "space_interests_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_interests" ADD CONSTRAINT "space_interests_mapObjectId_fkey" FOREIGN KEY ("mapObjectId") REFERENCES "map_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
