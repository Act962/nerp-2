-- Padrões do Sistema: escopo USER (org) / SYSTEM (universal). Aditivo e seguro.
-- organizationId vira nulável (SYSTEM = null); scope + createdByEmail novos.
ALTER TABLE "promotional_catalog_templates"
  ALTER COLUMN "organizationId" DROP NOT NULL;

ALTER TABLE "promotional_catalog_templates"
  ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'USER';

ALTER TABLE "promotional_catalog_templates"
  ADD COLUMN IF NOT EXISTS "createdByEmail" TEXT;
