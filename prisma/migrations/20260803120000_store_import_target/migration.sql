-- Destino da importação: a carteira da organização ou o catálogo nacional.
--
-- CREATE TYPE novo pode ser usado na mesma transação — a restrição do Postgres
-- vale só para ALTER TYPE ... ADD VALUE sobre um enum já existente.
CREATE TYPE "StoreImportTarget" AS ENUM ('ORGANIZACAO', 'CATALOGO');

-- ORGANIZACAO é o comportamento de sempre: nenhuma importação existente muda.
ALTER TABLE "store_imports" ADD COLUMN "target" "StoreImportTarget" NOT NULL DEFAULT 'ORGANIZACAO';
