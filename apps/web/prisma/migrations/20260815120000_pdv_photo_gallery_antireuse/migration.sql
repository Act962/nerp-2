-- Galeria App + trava anti-reuso da foto do promotor: origem, impressão digital
-- (hash), estados rascunho/consumo e flag de possível reuso.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PdvPhotoSource" AS ENUM ('APP_CAMERA', 'PHONE_LIBRARY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "pdv_photos"
  ADD COLUMN IF NOT EXISTS "source" "PdvPhotoSource" NOT NULL DEFAULT 'APP_CAMERA',
  ADD COLUMN IF NOT EXISTS "imageHash" TEXT,
  ADD COLUMN IF NOT EXISTS "perceptualHash" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "consumedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "possibleReuse" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reuseOfId" TEXT;

-- Backfill: fotos existentes contam como já enviadas (submittedAt = createdAt)
-- para não ficarem presas como rascunho fora da fila; as aprovadas contam como
-- consumidas (consumedAt = reviewedAt). Preserva o comportamento atual.
UPDATE "pdv_photos" SET "submittedAt" = "createdAt" WHERE "submittedAt" IS NULL;
UPDATE "pdv_photos"
  SET "consumedAt" = "reviewedAt"
  WHERE "consumedAt" IS NULL
    AND "approvalStatus" = 'APPROVED'
    AND "reviewedAt" IS NOT NULL;

-- Self-relation (foto original de um possível reuso)
DO $$ BEGIN
  ALTER TABLE "pdv_photos"
    ADD CONSTRAINT "pdv_photos_reuseOfId_fkey"
    FOREIGN KEY ("reuseOfId") REFERENCES "pdv_photos"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS "pdv_photos_organizationId_imageHash_idx"
  ON "pdv_photos"("organizationId", "imageHash");
CREATE INDEX IF NOT EXISTS "pdv_photos_organizationId_createdById_submittedAt_idx"
  ON "pdv_photos"("organizationId", "createdById", "submittedAt");
