-- URL pública legível da loja: /tradegram/<slug>.
--
-- Único GLOBALMENTE, não por organização: o segmento é o mesmo de
-- /tradegram/<slug-da-organizacao>, então os dois namespaces precisam conviver
-- sem ambiguidade. Anulável porque loja de empresa sem perfil público não tem
-- página — e NULL não colide com NULL no Postgres, então isso não custa nada.
--
-- Sem backfill aqui de propósito: slugificar em SQL exigiria a extensão
-- `unaccent`, que pode não estar instalada, e um backfill meio-certo é pior que
-- nenhum. Quem preenche é a procedure `store.backfillSlugs`, e quem não tiver
-- slug continua acessível pela URL antiga.
ALTER TABLE "stores" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");
