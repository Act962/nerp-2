-- Personalização da vitrine: cor própria do cabeçalho e a paleta da marca.
--
-- Aditiva, com IF NOT EXISTS por causa do banco compartilhado. `headerColor`
-- nasce nulo: nulo é o cabeçalho neutro de sempre, e um default aqui
-- repintaria o topo de todas as lojas numa migração.
ALTER TABLE "catalog_settings"
  ADD COLUMN IF NOT EXISTS "headerColor" TEXT,
  ADD COLUMN IF NOT EXISTS "brandColors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
