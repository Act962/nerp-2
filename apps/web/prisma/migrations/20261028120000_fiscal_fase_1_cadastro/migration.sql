-- Fiscal Fase 1 (specs/fiscal-nfce.md): padrões de tributação da empresa,
-- CST do IBS/CBS no produto e dados fiscais do cliente. Tudo opcional e
-- idempotente, no mesmo molde das migrations fiscais anteriores.

ALTER TABLE "fiscal_configs" ADD COLUMN IF NOT EXISTS "default_cfop" TEXT;
ALTER TABLE "fiscal_configs" ADD COLUMN IF NOT EXISTS "default_cst_icms" TEXT;
ALTER TABLE "fiscal_configs" ADD COLUMN IF NOT EXISTS "default_cst_pis" TEXT;
ALTER TABLE "fiscal_configs" ADD COLUMN IF NOT EXISTS "default_cst_cofins" TEXT;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cstIbsCbs" TEXT;

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "cityCode" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "stateRegistration" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "ieIndicator" TEXT;
