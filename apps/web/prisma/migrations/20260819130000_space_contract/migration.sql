-- Contratos de espaço (TradeGram): promove SpaceNegotiation a contrato de 1a
-- classe (ciclo de vida próprio) e liga os recebíveis gerados no Financeiro.
-- Tudo aditivo/nullable: nada existente muda.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ContractStatus" AS ENUM ('ATIVO', 'EXPIRADO', 'CANCELADO', 'RENOVADO', 'SUSPENSO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ContractBilling" AS ENUM ('MENSAL', 'UNICO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- SpaceNegotiation: campos de contrato
ALTER TABLE "space_negotiations"
  ADD COLUMN IF NOT EXISTS "contractStatus" "ContractStatus",
  ADD COLUMN IF NOT EXISTS "contractBilling" "ContractBilling",
  ADD COLUMN IF NOT EXISTS "contractActivatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contractDocumentUrl" TEXT;

CREATE INDEX IF NOT EXISTS "space_negotiations_mapObjectId_contractStatus_idx"
  ON "space_negotiations" ("mapObjectId", "contractStatus");

-- PaymentEntry: liga o recebível ao contrato
ALTER TABLE "payment_entries"
  ADD COLUMN IF NOT EXISTS "space_negotiation_id" TEXT;

CREATE INDEX IF NOT EXISTS "payment_entries_space_negotiation_id_idx"
  ON "payment_entries" ("space_negotiation_id");

DO $$ BEGIN
  ALTER TABLE "payment_entries"
    ADD CONSTRAINT "payment_entries_space_negotiation_id_fkey"
    FOREIGN KEY ("space_negotiation_id") REFERENCES "space_negotiations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
