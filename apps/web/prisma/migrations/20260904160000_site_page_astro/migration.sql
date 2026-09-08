-- O que o Astro sabe de cada página do site.
--
-- Duas colunas e não uma, pelo mesmo motivo de `blocks`/`publishedBlocks`:
-- editar uma fala do mascote não pode colocá-la no ar antes de a página
-- inteira estar publicada. O site lê só a coluna publicada.
--
-- Idempotente, no padrão das migrações site_* anteriores.

ALTER TABLE "site_pages" ADD COLUMN IF NOT EXISTS "astro" JSONB;
ALTER TABLE "site_pages" ADD COLUMN IF NOT EXISTS "astroPublished" JSONB;
