-- Idempotente: este schema já existe em bancos que o receberam à mão, sem a
-- linha correspondente no _prisma_migrations. As guardas deixam o
-- `migrate deploy` registrar a migração sem tentar recriar o que já está lá.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PdvMediaType" AS ENUM ('IMAGE', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable: painel de mídia do PDV (config por organização)
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "pdvMediaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "pdvMediaPauseSeconds" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE IF NOT EXISTS "pdv_medias" (
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
CREATE INDEX IF NOT EXISTS "pdv_medias_organizationId_idx" ON "pdv_medias"("organizationId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pdv_medias" ADD CONSTRAINT "pdv_medias_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
