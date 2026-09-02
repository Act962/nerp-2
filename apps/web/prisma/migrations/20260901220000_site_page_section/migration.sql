-- Em que trecho do site a página vive.
--
-- O slug continua único no site inteiro, mas a URL tem três prefixos
-- (/solucoes, /segmentos, /sobre) e uma página só pertence a um deles. Sem
-- esta coluna, /solucoes/supermercados abriria a página do segmento — o
-- endereço existiria em dois lugares e o Google veria conteúdo duplicado.
--
-- Default SOLUCOES porque era o único trecho que existia até aqui.

DO $$ BEGIN
  CREATE TYPE "SitePageSection" AS ENUM ('SOLUCOES', 'SEGMENTOS', 'SOBRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "site_pages"
  ADD COLUMN IF NOT EXISTS "section" "SitePageSection" NOT NULL DEFAULT 'SOLUCOES';
