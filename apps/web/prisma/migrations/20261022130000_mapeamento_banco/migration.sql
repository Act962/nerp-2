-- Mapeamento do banco do ERP do cliente para os tipos do NERP (spec mapeamento-banco).
ALTER TABLE "erp_connections" ADD COLUMN IF NOT EXISTS "dataMapping" JSONB;
