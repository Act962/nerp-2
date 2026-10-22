-- Vínculo do cliente com o ERP para a importação pelo mapeamento do banco (spec mapeamento-banco).
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "erpCode" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "erpBlocked" BOOLEAN;
CREATE INDEX IF NOT EXISTS "customers_organizationId_erpCode_idx" ON "customers"("organizationId", "erpCode");
