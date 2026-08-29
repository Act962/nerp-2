-- Favorito de tipo de mídia por org (seletor no card de aprovação).
--
-- Idempotente: este schema já existe em bancos que o receberam à mão, sem a
-- linha correspondente no _prisma_migrations. A guarda deixa o `migrate deploy`
-- registrar a migração sem tentar recriar o que já está lá.
ALTER TABLE "media_types" ADD COLUMN IF NOT EXISTS "isFavorite" BOOLEAN NOT NULL DEFAULT false;
