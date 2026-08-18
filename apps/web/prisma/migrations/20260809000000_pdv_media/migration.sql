-- CreateEnum
CREATE TYPE "PdvMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable: painel de mídia do PDV (config por organização)
ALTER TABLE "organization" ADD COLUMN "pdvMediaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organization" ADD COLUMN "pdvMediaPauseSeconds" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "pdv_medias" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "type" "PdvMediaType" NOT NULL DEFAULT 'IMAGE',
    "durationSeconds" INTEGER NOT NULL DEFAULT 8,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdv_medias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pdv_medias_organizationId_idx" ON "pdv_medias"("organizationId");

-- AddForeignKey
ALTER TABLE "pdv_medias" ADD CONSTRAINT "pdv_medias_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
