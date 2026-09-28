-- Modo ORBITA do Catálogo Online: o pedido vira Sale.PENDING_APPROVAL e é
-- empurrado ao Órbita, que negocia, cobra via PIX e confirma a venda de volta.
--
-- Aditiva de ponta a ponta. O valor novo do enum não é usado nesta mesma
-- migration (o Postgres não deixa usar um valor de enum na transação que o
-- criou), e as colunas nascem nulas: venda que não veio do Órbita não tem o
-- que guardar aqui.
ALTER TYPE "CatalogOperationMode" ADD VALUE IF NOT EXISTS 'ORBITA';

ALTER TABLE "sales"
  ADD COLUMN IF NOT EXISTS "orbitaOrderToken" TEXT,
  ADD COLUMN IF NOT EXISTS "orbitaPortalUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "orbitaWhatsappUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "orbitaSyncedAt" TIMESTAMP(3);
