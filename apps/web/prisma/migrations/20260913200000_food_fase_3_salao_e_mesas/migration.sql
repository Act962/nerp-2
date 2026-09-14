-- Food Fase 3 — salão e mesas.
--
-- A mesa deixa de ser texto digitado a cada pedido e vira cadastro, com
-- adesivo de QR próprio. `kitchen_orders.tableNumber` CONTINUA existindo: ele é
-- o rótulo que o board, a TV e a busca já mostram, e pedido antigo não tem
-- mesa para apontar. `tableId` é o vínculo; o texto é o retrato.

CREATE TABLE IF NOT EXISTS "service_tables" (
  "id"                 TEXT NOT NULL,
  "organizationId"     TEXT NOT NULL,
  "number"             INTEGER NOT NULL,
  "name"               TEXT,
  "seats"              INTEGER,
  "qrToken"            TEXT NOT NULL,
  "closingRequestedAt" TIMESTAMP(3),
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_tables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_tables_qrToken_key"
  ON "service_tables" ("qrToken");
CREATE UNIQUE INDEX IF NOT EXISTS "service_tables_organizationId_number_key"
  ON "service_tables" ("organizationId", "number");
CREATE INDEX IF NOT EXISTS "service_tables_organizationId_isActive_idx"
  ON "service_tables" ("organizationId", "isActive");

DO $$
BEGIN
  ALTER TABLE "service_tables"
    ADD CONSTRAINT "service_tables_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "kitchen_orders" ADD COLUMN IF NOT EXISTS "tableId" TEXT;

CREATE INDEX IF NOT EXISTS "kitchen_orders_tableId_archivedAt_idx"
  ON "kitchen_orders" ("tableId", "archivedAt");

DO $$
BEGIN
  ALTER TABLE "kitchen_orders"
    ADD CONSTRAINT "kitchen_orders_tableId_fkey"
    FOREIGN KEY ("tableId") REFERENCES "service_tables"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
