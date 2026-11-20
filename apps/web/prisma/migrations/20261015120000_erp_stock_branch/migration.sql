-- Filial do estoque do sync do ERP (spec erp-sync-estoque-preco-winthor).
ALTER TABLE "erp_connections" ADD COLUMN IF NOT EXISTS "stockBranchCode" TEXT;
