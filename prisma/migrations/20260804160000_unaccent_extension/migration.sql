-- Ignorar acentos na busca do TradeGram e outros pontos que usarem
-- unaccent(). Idempotente — CREATE EXTENSION IF NOT EXISTS é seguro rodar
-- repetido, e o Neon sa-east-1 já expõe a extensão.
CREATE EXTENSION IF NOT EXISTS unaccent;
