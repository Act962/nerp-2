-- Adiciona o marcador "Gostei/Legal" nas fotos do PDV.
-- IF NOT EXISTS: a coluna já foi aplicada manualmente na base compartilhada
-- (migrate deploy estava bloqueado por uma migração falha pré-existente).
ALTER TABLE "pdv_photos" ADD COLUMN IF NOT EXISTS "liked" BOOLEAN NOT NULL DEFAULT false;
