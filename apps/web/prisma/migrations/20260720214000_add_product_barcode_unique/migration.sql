-- Normaliza barcode vazio para NULL ANTES de criar o unique.
-- No Postgres, NULL não conflita em UNIQUE mas string vazia sim: sem este passo,
-- dois produtos sem EAN gravados como '' quebram a criação do índice — e como
-- `pnpm build` roda `migrate deploy`, isso derrubaria o deploy, não só o runtime.
UPDATE "products" SET "barcode" = NULL WHERE "barcode" = '';

-- DropIndex
DROP INDEX IF EXISTS "products_organizationId_barcode_idx";

-- CreateIndex
CREATE UNIQUE INDEX "products_organizationId_barcode_key" ON "products"("organizationId", "barcode");
