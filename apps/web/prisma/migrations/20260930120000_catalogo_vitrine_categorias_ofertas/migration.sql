-- Vitrine nova do catálogo: como as categorias aparecem, o ícone de cada uma e
-- o botão de ofertas que aponta para catálogos promocionais.
--
-- Aditiva de ponta a ponta, com IF NOT EXISTS por causa do banco compartilhado.
-- `categoryDisplay` nasce ICON: a loja que nunca configurou nada ganha ícones
-- na hora — sem ícone escolhido, a vitrine mostra um ícone neutro.

ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "icon" TEXT;

DO $$ BEGIN
  CREATE TYPE "CatalogCategoryDisplay" AS ENUM ('ICON', 'IMAGE', 'TEXT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "catalog_settings"
  ADD COLUMN IF NOT EXISTS "categoryDisplay" "CatalogCategoryDisplay" NOT NULL DEFAULT 'ICON',
  ADD COLUMN IF NOT EXISTS "showOffersButton" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "offerCatalogIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
