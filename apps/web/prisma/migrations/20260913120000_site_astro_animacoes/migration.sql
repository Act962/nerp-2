-- As animações do ASTRO, montadas no editor de `/site/animacoes`.
--
-- Global, sem `organization_id`, como todas as `site_*`: o site é um só.
--
-- `momento` é único e aceita nulo. No Postgres vários NULL convivem no mesmo
-- índice único, e é isso que dá de graça o par rascunho/publicado: quantos
-- rascunhos se quiser, e no máximo uma cena respondendo por cada momento.
CREATE TABLE IF NOT EXISTS "site_astro_animacoes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "momento" TEXT,
    "cena" JSONB NOT NULL,
    "criadaPor" TEXT,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_astro_animacoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "site_astro_animacoes_slug_key" ON "site_astro_animacoes"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "site_astro_animacoes_momento_key" ON "site_astro_animacoes"("momento");
CREATE INDEX IF NOT EXISTS "site_astro_animacoes_atualizadaEm_idx" ON "site_astro_animacoes"("atualizadaEm");
