-- Status do produto no ERP de origem (Oracle/Winthor), separado do `isActive`
-- do NERP: um produto pode existir e estar ativo no ERP e ainda assim não estar
-- disponível para venda aqui — e vice-versa.
--
-- `erpActive` é NULO por padrão de propósito: "nunca sincronizado" não pode se
-- confundir com "inativo no ERP".
--
-- Colunas em camelCase e entre aspas: é a convenção real desta tabela
-- (`organizationId`, `isActive`), apesar do `@@map("products")`.
--
-- IF NOT EXISTS porque o `migrate deploy` desta base está bloqueado por uma
-- migração falha anterior (P3009) e esta é aplicada à mão.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "erpActive" BOOLEAN;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "erpCode" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "erpSyncedAt" TIMESTAMP(3);

-- O filtro "ativo no ERP" do catálogo sempre vem junto com a organização.
CREATE INDEX IF NOT EXISTS "products_organizationId_erpActive_idx"
  ON "products" ("organizationId", "erpActive");

-- Limpa as colunas em snake_case criadas por engano numa primeira tentativa.
ALTER TABLE "products" DROP COLUMN IF EXISTS "erp_active";
ALTER TABLE "products" DROP COLUMN IF EXISTS "erp_code";
ALTER TABLE "products" DROP COLUMN IF EXISTS "erp_synced_at";
