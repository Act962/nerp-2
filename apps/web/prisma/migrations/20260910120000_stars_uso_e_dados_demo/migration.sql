-- ★ consumidas desde o início do ciclo (barra de uso do plano) e a marca de
-- dado de exemplo semeado na criação da organização.
--
-- `IF NOT EXISTS` em tudo: esta base já esteve bloqueada por migração falha
-- (P3009) e as recentes são aplicadas à mão — a migration precisa ser
-- reexecutável sem estourar.
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "stars_used_in_cycle" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "products"             ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers"            ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "suppliers"            ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stores"               ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "categories"           ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "promotional_catalogs" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
