-- Fiscal Fase 3 (specs/fiscal-nfce.md): inutilização de numeração, XML do
-- evento de cancelamento e o índice "um vigente por venda" passando a ignorar
-- também a nota inutilizada. Idempotente, no molde das migrations fiscais.

ALTER TABLE "fiscal_documents" ADD COLUMN IF NOT EXISTS "cancelXmlKey" TEXT;
ALTER TABLE "fiscal_documents" ADD COLUMN IF NOT EXISTS "inutilizacaoId" TEXT;

-- Mesma lista de `STATUS_FORA_DE_VIGOR` em @nerp/fiscal.
DROP INDEX IF EXISTS "fiscal_documents_vigente_por_venda";
CREATE UNIQUE INDEX "fiscal_documents_vigente_por_venda"
  ON "fiscal_documents"("saleId", "type")
  WHERE "status" NOT IN ('CANCELLED', 'VOIDED');

CREATE TABLE IF NOT EXISTS "fiscal_inutilizacoes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "FiscalDocumentType" NOT NULL,
    "environment" TEXT NOT NULL,
    "serie" INTEGER NOT NULL,
    "numeroInicial" INTEGER NOT NULL,
    "numeroFinal" INTEGER NOT NULL,
    "justificativa" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "inutilizadaEm" TIMESTAMP(3) NOT NULL,
    "xmlKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_inutilizacoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fiscal_inutilizacoes_organizationId_type_serie_idx"
  ON "fiscal_inutilizacoes"("organizationId", "type", "serie");

DO $$ BEGIN
  ALTER TABLE "fiscal_inutilizacoes" ADD CONSTRAINT "fiscal_inutilizacoes_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
