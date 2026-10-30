-- Fiscal Fase 2 (specs/fiscal-nfce.md): documento fiscal 1:N com a venda,
-- conteúdo enviado guardado no documento, QR Code do DANFCe e numeração por
-- série controlada pelo NERP. Idempotente, no molde das migrations fiscais.

ALTER TABLE "fiscal_documents" ADD COLUMN IF NOT EXISTS "tpEmis" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "fiscal_documents" ADD COLUMN IF NOT EXISTS "emitterCnpj" TEXT;
ALTER TABLE "fiscal_documents" ADD COLUMN IF NOT EXISTS "nota" JSONB;
ALTER TABLE "fiscal_documents" ADD COLUMN IF NOT EXISTS "qrCodeUrl" TEXT;
ALTER TABLE "fiscal_documents" ADD COLUMN IF NOT EXISTS "consultaUrl" TEXT;

-- 1:1 → 1:N: a venda pode ter a nota rejeitada, cancelada e reemitida.
DROP INDEX IF EXISTS "fiscal_documents_saleId_key";
CREATE INDEX IF NOT EXISTS "fiscal_documents_saleId_idx" ON "fiscal_documents"("saleId");

-- Número único por série. NULL não colide (nota ainda sem número).
CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_documents_organizationId_type_serie_numero_key"
  ON "fiscal_documents"("organizationId", "type", "serie", "numero");

-- No máximo UM documento vigente por venda e modelo. Fecha a corrida de dois
-- cliques simultâneos em "emitir": o segundo INSERT falha em vez de criar
-- duas notas. Índice parcial — o Prisma não o representa no schema.
CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_documents_vigente_por_venda"
  ON "fiscal_documents"("saleId", "type")
  WHERE "status" <> 'CANCELLED';

CREATE TABLE IF NOT EXISTS "fiscal_series" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "FiscalDocumentType" NOT NULL,
    "serie" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_series_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_series_organizationId_type_serie_key"
  ON "fiscal_series"("organizationId", "type", "serie");

DO $$ BEGIN
  ALTER TABLE "fiscal_series" ADD CONSTRAINT "fiscal_series_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
