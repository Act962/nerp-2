-- Pedidos unificados: toda venda passa a dizer de onde veio, e o prato da
-- cozinha aponta para a venda do Catálogo que o originou.
--
-- Aditiva. O enum é novo (CREATE TYPE, não ADD VALUE), então pode ser usado
-- nesta mesma transação — no default e no backfill.
CREATE TYPE "SaleOrigin" AS ENUM (
  'PDV',
  'CATALOGO_APROVACAO',
  'CATALOGO_ORBITA',
  'CATALOGO_COZINHA',
  'CATALOGO_MARKETPLACE'
);

ALTER TABLE "sales"
  ADD COLUMN "origin" "SaleOrigin" NOT NULL DEFAULT 'PDV';

-- Backfill do que dá para afirmar com os dados que já existem:
--   * token do Órbita só existe em pedido do modo ORBITA;
--   * PENDING_APPROVAL só nasce no Catálogo; sem token, é do modo APPROVAL.
-- Cozinha e marketplace antigos não deixaram rastro confiável e ficam PDV.
UPDATE "sales" SET "origin" = 'CATALOGO_ORBITA'
  WHERE "orbitaOrderToken" IS NOT NULL;

UPDATE "sales" SET "origin" = 'CATALOGO_APROVACAO'
  WHERE "status" = 'PENDING_APPROVAL' AND "orbitaOrderToken" IS NULL;

CREATE INDEX "sales_organizationId_origin_status_idx"
  ON "sales"("organizationId", "origin", "status");

ALTER TABLE "kitchen_orders" ADD COLUMN "saleId" TEXT;

CREATE INDEX "kitchen_orders_saleId_idx" ON "kitchen_orders"("saleId");

ALTER TABLE "kitchen_orders"
  ADD CONSTRAINT "kitchen_orders_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "sales"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
