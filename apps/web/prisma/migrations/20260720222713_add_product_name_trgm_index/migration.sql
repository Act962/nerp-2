-- Busca de produto no seletor do planograma: com 400 mil SKUs, um
-- `ILIKE '%termo%'` sem índice é sequential scan A CADA TECLA digitada.
-- O índice GIN com trigram torna a busca por trecho de nome indexada.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "products_name_trgm_idx"
  ON "products" USING gin ("name" gin_trgm_ops);
