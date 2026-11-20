-- Código do produto na vitrine (padrão desligado).
ALTER TABLE "catalog_settings" ADD COLUMN IF NOT EXISTS "showProductCode" BOOLEAN NOT NULL DEFAULT false;
