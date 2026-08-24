-- Idempotência do replay offline de caixa (device → server).
-- Colunas nullable: sessões/movimentos criados pelo web seguem com NULL (o
-- Postgres trata NULLs como distintos no índice único, então não colidem).

ALTER TABLE "cash_sessions" ADD COLUMN "clientSessionId" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN "clientOperationId" TEXT;

CREATE UNIQUE INDEX "cash_sessions_clientSessionId_key" ON "cash_sessions"("clientSessionId");
CREATE UNIQUE INDEX "cash_movements_clientOperationId_key" ON "cash_movements"("clientOperationId");
