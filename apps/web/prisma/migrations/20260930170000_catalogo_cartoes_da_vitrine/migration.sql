-- Vitrine: cores dos cartões de categoria e a opção de esconder produto sem foto.
--
-- Aditiva, com IF NOT EXISTS por causa do banco compartilhado. As cores nascem
-- nulas (nulo = cartão branco com ícone na cor do tema) e esconder produto sem
-- foto nasce desligado: ligar por padrão sumiria produtos de lojas no ar.
ALTER TABLE "catalog_settings"
  ADD COLUMN IF NOT EXISTS "categoryCardColor" TEXT,
  ADD COLUMN IF NOT EXISTS "categoryIconColor" TEXT,
  ADD COLUMN IF NOT EXISTS "categoryTextColor" TEXT,
  ADD COLUMN IF NOT EXISTS "hideProductsWithoutImage" BOOLEAN NOT NULL DEFAULT false;
