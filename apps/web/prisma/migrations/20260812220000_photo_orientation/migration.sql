-- Padrões de foto por orientação (horizontal/vertical) + cache de proporção da
-- foto no PdvPhoto pra o auto-gerador rotear sem re-baixar a imagem.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PhotoOrientation" AS ENUM ('LANDSCAPE', 'PORTRAIT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "book_page_templates"
ADD COLUMN IF NOT EXISTS "photoOrientation" "PhotoOrientation";

ALTER TABLE "pdv_photos"
ADD COLUMN IF NOT EXISTS "photoAspect" DOUBLE PRECISION;

-- Backfill: padrões PHOTO já existentes viram VERTICAL (mantêm o photoSize).
-- Os antigos eram grades quadradas/verticais; o usuário reajusta se precisar.
UPDATE "book_page_templates"
SET "photoOrientation" = 'PORTRAIT'
WHERE "kind" = 'PHOTO' AND "photoOrientation" IS NULL;
