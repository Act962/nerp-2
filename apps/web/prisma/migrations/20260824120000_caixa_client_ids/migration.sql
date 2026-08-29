-- Idempotência do replay offline de caixa (device → server).
-- Colunas nullable: sessões/movimentos criados pelo web seguem com NULL (o
-- Postgres trata NULLs como distintos no índice único, então não colidem).
--
-- As guardas `IF NOT EXISTS` existem porque este schema já foi aplicado à mão
-- em bancos que não têm a linha correspondente no _prisma_migrations.

ALTER TABLE "cash_sessions" ADD COLUMN IF NOT EXISTS "clientSessionId" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN IF NOT EXISTS "clientOperationId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "cash_sessions_clientSessionId_key" ON "cash_sessions"("clientSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "cash_movements_clientOperationId_key" ON "cash_movements"("clientOperationId");
