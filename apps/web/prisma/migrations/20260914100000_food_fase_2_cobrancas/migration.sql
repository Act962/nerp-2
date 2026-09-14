-- Food Fase 2 — cobranças.
--
-- Duas tabelas, cada uma por um motivo de dinheiro:
--   charges                   rastro da tentativa de cobrança. Nunca apagar linha:
--                             é o que responde "o cliente pagou e o pedido não entrou".
--   processed_webhook_events  trava de reentrega. O provedor reenvia quando não
--                             recebe 200, e sem isso o pedido entra duas vezes.
--
-- A CREDENCIAL não ganha tabela: `financial_integrations` já é o cofre por
-- organização (AES-256-GCM, mesmo do S2S), já tem `environment` e já tem tela
-- de instalação. Um segundo lugar para guardar chave é um segundo lugar de onde
-- ela pode vazar.

DO $$
BEGIN
  CREATE TYPE "ChargeStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'REFUNDED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "charges" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "saleId"         TEXT,
  "integrationId"  TEXT,
  "provider"       TEXT NOT NULL,
  "externalId"     TEXT NOT NULL,
  "status"         "ChargeStatus" NOT NULL DEFAULT 'PENDING',
  "method"         "PaymentMethod" NOT NULL,
  "amount"         DECIMAL(10,2) NOT NULL,
  "pixPayload"     TEXT,
  "pixQrImage"     TEXT,
  "paidAt"         TIMESTAMP(3),
  "expiresAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- A chave que o webhook usa para reencontrar a cobrança. Única de propósito:
-- dois registros para a mesma cobrança do provedor é ambiguidade sobre dinheiro.
CREATE UNIQUE INDEX IF NOT EXISTS "charges_provider_externalId_key"
  ON "charges" ("provider", "externalId");
CREATE INDEX IF NOT EXISTS "charges_organizationId_status_idx"
  ON "charges" ("organizationId", "status");
CREATE INDEX IF NOT EXISTS "charges_saleId_idx" ON "charges" ("saleId");

CREATE TABLE IF NOT EXISTS "processed_webhook_events" (
  "id"        TEXT NOT NULL,
  "provider"  TEXT NOT NULL,
  "eventId"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "processed_webhook_events_provider_eventId_key"
  ON "processed_webhook_events" ("provider", "eventId");
CREATE INDEX IF NOT EXISTS "processed_webhook_events_createdAt_idx"
  ON "processed_webhook_events" ("createdAt");

DO $$
BEGIN
  ALTER TABLE "charges"
    ADD CONSTRAINT "charges_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "charges"
    ADD CONSTRAINT "charges_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "sales"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "charges"
    ADD CONSTRAINT "charges_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "financial_integrations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
