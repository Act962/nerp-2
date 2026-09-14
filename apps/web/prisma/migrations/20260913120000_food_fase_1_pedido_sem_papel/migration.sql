-- Food Fase 1 — o pedido sem papel.
--
-- Escrita à mão e aplicada com `migrate deploy`: o banco de desenvolvimento é
-- compartilhado e `migrate dev` quer resetar por drift.

-- ---------------------------------------------------------------------------
-- O "pedido" passa a existir
-- ---------------------------------------------------------------------------
-- Até aqui cada ITEM era um kitchen_orders solto e a quantidade vivia dentro do
-- texto ("2x Coxinha"). Sem agrupamento não há cupom por pedido nem tela de
-- acompanhamento do pedido inteiro. ticket_id é o que costura os itens criados
-- juntos; a leitura agrupa por `ticket_id ?? id`, então pedido antigo continua
-- valendo como ticket de um item e nenhum backfill de ticket é necessário.
ALTER TABLE "kitchen_orders" ADD COLUMN IF NOT EXISTS "ticketId" TEXT;
ALTER TABLE "kitchen_orders" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
ALTER TABLE "kitchen_orders" ADD COLUMN IF NOT EXISTS "printedAt" TIMESTAMP(3);
ALTER TABLE "kitchen_orders" ADD COLUMN IF NOT EXISTS "saleId" TEXT;

-- Backfill — os dois UPDATEs abaixo NÃO são opcionais.
--
-- Sem o primeiro, todo pedido em andamento fica com accepted_at nulo, cai na
-- fila de "aguardando aceite" e SOME do board no momento do deploy.
UPDATE "kitchen_orders" SET "acceptedAt" = "createdAt" WHERE "acceptedAt" IS NULL;

-- Sem o segundo, a estação de impressão entende que o histórico inteiro da
-- organização nunca foi impresso e despeja a bobina toda quando o dono conecta
-- a impressora pela primeira vez.
UPDATE "kitchen_orders" SET "printedAt" = "createdAt" WHERE "printedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "kitchen_orders_organizationId_ticketId_idx"
  ON "kitchen_orders" ("organizationId", "ticketId");
CREATE INDEX IF NOT EXISTS "kitchen_orders_organizationId_acceptedAt_idx"
  ON "kitchen_orders" ("organizationId", "acceptedAt");
CREATE INDEX IF NOT EXISTS "kitchen_orders_organizationId_printedAt_idx"
  ON "kitchen_orders" ("organizationId", "printedAt");
CREATE INDEX IF NOT EXISTS "kitchen_orders_saleId_idx"
  ON "kitchen_orders" ("saleId");

-- O elo pedido ↔ venda não existia. É ele que dá ao cupom acesso a total e
-- pagamento, e que permite tirar o pedido do cardápio da fila de aprovação do
-- PDV (`kitchenOrders: { none: {} }`).
DO $$
BEGIN
  ALTER TABLE "kitchen_orders"
    ADD CONSTRAINT "kitchen_orders_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- "Sem cebola" atravessando o checkout
-- ---------------------------------------------------------------------------
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- ---------------------------------------------------------------------------
-- Aceite e recusa viram evento
-- ---------------------------------------------------------------------------
ALTER TYPE "KitchenOrderEventType" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "KitchenOrderEventType" ADD VALUE IF NOT EXISTS 'REJECTED';

-- ---------------------------------------------------------------------------
-- Segmento de alimentação e leiaute de cardápio
-- ---------------------------------------------------------------------------
ALTER TYPE "OrgSegment" ADD VALUE IF NOT EXISTS 'ALIMENTACAO';

DO $$
BEGIN
  CREATE TYPE "CatalogLayout" AS ENUM ('LISTA', 'CARDAPIO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "catalog_settings"
  ADD COLUMN IF NOT EXISTS "layout" "CatalogLayout" NOT NULL DEFAULT 'LISTA';
