-- Classifica cada BookPageTemplate por tipo de página (capa/foto/extra/final)
-- e, para páginas de fotos, o tamanho (1..4). Registros existentes viram PHOTO.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BookPageTemplateKind" AS ENUM ('COVER', 'PHOTO', 'EXTRA', 'CLOSING');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "book_page_templates"
ADD COLUMN IF NOT EXISTS "kind" "BookPageTemplateKind" NOT NULL DEFAULT 'PHOTO',
ADD COLUMN IF NOT EXISTS "photoSize" INTEGER;

-- Backfill: padrões salvos pelo editor auto (nomes auto-1..auto-4) já sabem o
-- tamanho; inferimos photoSize a partir do sufixo. Os demais PHOTO ficam sem
-- tamanho (o usuário define ao reeditar).
UPDATE "book_page_templates" SET "photoSize" = 1 WHERE "name" = 'auto-1';
UPDATE "book_page_templates" SET "photoSize" = 2 WHERE "name" = 'auto-2';
UPDATE "book_page_templates" SET "photoSize" = 3 WHERE "name" = 'auto-3';
UPDATE "book_page_templates" SET "photoSize" = 4 WHERE "name" = 'auto-4';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "book_page_templates_organizationId_supplierId_kind_idx"
ON "book_page_templates"("organizationId", "supplierId", "kind");
