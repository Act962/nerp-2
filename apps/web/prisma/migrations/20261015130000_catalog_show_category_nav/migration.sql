-- Liga/desliga da seção "Navegue por categoria" na vitrine (padrão ligado).
ALTER TABLE "catalog_settings" ADD COLUMN IF NOT EXISTS "showCategoryNav" BOOLEAN NOT NULL DEFAULT true;
