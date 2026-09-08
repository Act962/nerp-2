-- Estoque do produto POR FILIAL do ERP, espelhado do Winthor (PCEST).
--
-- Só entra linha com estoque (QTESTGER >= 1): guardar as zeradas triplicaria a
-- tabela (~24 mil produtos × 3 filiais) para responder a mesma pergunta pelo
-- avesso — "tem linha" É "tem estoque".
--
-- Separada de store_products de propósito: `Store` é a loja CLIENTE do trade
-- marketing, filial é a unidade do próprio ERP.

CREATE TABLE IF NOT EXISTS "product_branch_stocks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "branchCode" TEXT NOT NULL,
    "branchName" TEXT,
    "stock" DECIMAL(14,3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_branch_stocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_branch_stocks_productId_branchCode_key"
    ON "product_branch_stocks"("productId", "branchCode");

CREATE INDEX IF NOT EXISTS "product_branch_stocks_organizationId_branchCode_idx"
    ON "product_branch_stocks"("organizationId", "branchCode");

ALTER TABLE "product_branch_stocks"
    DROP CONSTRAINT IF EXISTS "product_branch_stocks_productId_fkey";
ALTER TABLE "product_branch_stocks"
    ADD CONSTRAINT "product_branch_stocks_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
