-- Idempotente: este schema já existe em bancos que o receberam à mão, sem a
-- linha correspondente no _prisma_migrations. As guardas deixam o
-- `migrate deploy` registrar a migração sem tentar recriar o que já está lá.

-- AlterTable
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "clientOperationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sales_clientOperationId_key" ON "sales"("clientOperationId");
