-- Personalização da vitrine: cor de fundo da página e o Astro atendendo nela.
--
-- Aditiva de ponta a ponta. `background_color` nasce nulo de propósito: nulo é
-- "usa o fundo neutro do tema", que é exatamente o que as lojas já têm hoje —
-- um default de cor aqui repintaria todas elas numa migração.
ALTER TABLE "catalog_settings"
  ADD COLUMN IF NOT EXISTS "backgroundColor" TEXT,
  ADD COLUMN IF NOT EXISTS "astroEnabled" BOOLEAN NOT NULL DEFAULT true;

-- O canal da conversa do visitante da vitrine. É o único em que
-- `organization_id` aponta para a dona do catálogo, e não para quem está
-- logado: é a conta de ★ dela que paga a resposta.
ALTER TYPE "site_chat_channel" ADD VALUE IF NOT EXISTS 'CATALOGO';
