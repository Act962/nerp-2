-- Product.showInCatalog (visibilidade no catálogo online, independente de isActive)
--
-- Idempotente: este schema já existe em bancos que o receberam à mão, sem a
-- linha correspondente no _prisma_migrations. A guarda deixa o `migrate deploy`
-- registrar a migração sem tentar recriar o que já está lá.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "showInCatalog" BOOLEAN NOT NULL DEFAULT true;
