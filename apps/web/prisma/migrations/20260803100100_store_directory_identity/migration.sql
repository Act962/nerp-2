-- Identidade compartilhada do ponto de venda.
--
-- Sem este elo, duas organizações com o mesmo supermercado na carteira produzem
-- DOIS pinos no mesmo endereço no mapa público, sem caminho para reconciliar —
-- e um mapa que conta o mesmo PDV duas vezes destrói o argumento "N pontos no
-- Piauí" que justifica o cadastro nacional.
--
-- SET NULL, nunca CASCADE: apagar um ponto do catálogo global não pode apagar o
-- cliente de um inquilino.
ALTER TABLE "stores" ADD COLUMN "directoryStoreId" TEXT;
CREATE INDEX "stores_directoryStoreId_idx" ON "stores"("directoryStoreId");
ALTER TABLE "stores" ADD CONSTRAINT "stores_directoryStoreId_fkey"
    FOREIGN KEY ("directoryStoreId") REFERENCES "directory_stores"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Fila de revisão do super-admin: NULL = ainda não conferido. O ponto criado
-- pela foto do promotor entra no mapa na hora e é auditado depois.
ALTER TABLE "directory_stores" ADD COLUMN "reviewedAt" TIMESTAMP(3);
CREATE INDEX "directory_stores_reviewedAt_idx" ON "directory_stores"("reviewedAt");

-- Auditoria de qual organização originou o ponto. NUNCA sai em payload público:
-- revelaria onde cada empresa opera.
ALTER TABLE "directory_stores" ADD COLUMN "sourceOrgId" TEXT;
