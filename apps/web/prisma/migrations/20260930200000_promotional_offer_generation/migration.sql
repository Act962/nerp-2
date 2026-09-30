-- Gerador de oferta com IA (specs/catalogo-criacao-assistida-astro.md, Fase 3).
-- Só acréscimos. IF NOT EXISTS / duplicate_object: o banco de dev é
-- compartilhado entre branches e pode já ter recebido este SQL.

DO $$ BEGIN
  CREATE TYPE "AiOfferLevel" AS ENUM ('ECONOMICO', 'EQUILIBRADO', 'PREMIUM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OfferGenerationStatus" AS ENUM ('PENDING', 'GENERATING', 'DONE', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "organization"
  ADD COLUMN IF NOT EXISTS "aiOfferLevel" "AiOfferLevel" NOT NULL DEFAULT 'EQUILIBRADO';

CREATE TABLE IF NOT EXISTS "promotional_offer_generations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "catalogId" TEXT,
  "status" "OfferGenerationStatus" NOT NULL DEFAULT 'PENDING',
  "nivel" "AiOfferLevel" NOT NULL,
  "input" JSONB NOT NULL,
  "modelo" TEXT,
  "tokensIn" INTEGER NOT NULL DEFAULT 0,
  "tokensOut" INTEGER NOT NULL DEFAULT 0,
  "starsEstimadas" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "starsCobradas" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "resultado" JSONB,
  "erro" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "promotional_offer_generations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "promotional_offer_generations_organizationId_createdAt_idx"
  ON "promotional_offer_generations"("organizationId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "promotional_offer_generations"
    ADD CONSTRAINT "promotional_offer_generations_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
