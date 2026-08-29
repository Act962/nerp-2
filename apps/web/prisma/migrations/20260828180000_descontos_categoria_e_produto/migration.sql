-- Descontos promocionais com validade, em dois níveis.
--
-- 1) Produto: desconto GLOBAL (vale em qualquer tabela de preços), guardado em
--    colunas do próprio produto porque é um estado do item, não um vínculo.
--
-- 2) Categoria dentro de uma tabela de preços: uma REGRA, não preço
--    materializado. Gravar linha por produto faria a promoção ignorar produtos
--    cadastrados depois e exigiria reverter tudo no fim da vigência. Como
--    regra, produto novo já nasce com o desconto e o fim da janela devolve o
--    preço sozinho.
--
-- A vigência é lida na resolução de preço (resolve-price.ts), então não há job
-- para ligar nem desligar promoção.
--
-- IF NOT EXISTS porque o `migrate deploy` desta base está bloqueado por uma
-- migração falha anterior (P3009) e esta é aplicada à mão.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(5,2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "discountStartsAt" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "discountEndsAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "price_list_category_discounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "percentDiscount" DECIMAL(5,2) NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_list_category_discounts_pkey" PRIMARY KEY ("id")
);

-- Uma regra por (tabela, categoria): trocar o percentual é update, não uma
-- segunda linha competindo com a primeira.
CREATE UNIQUE INDEX IF NOT EXISTS "price_list_category_discounts_priceListId_categoryId_key"
    ON "price_list_category_discounts"("priceListId", "categoryId");
CREATE INDEX IF NOT EXISTS "price_list_category_discounts_organizationId_idx"
    ON "price_list_category_discounts"("organizationId");
-- Cobre a leitura da resolução: descontos vigentes de uma tabela.
CREATE INDEX IF NOT EXISTS "price_list_category_discounts_priceListId_endsAt_idx"
    ON "price_list_category_discounts"("priceListId", "endsAt");

DO $$
BEGIN
    ALTER TABLE "price_list_category_discounts"
        ADD CONSTRAINT "price_list_category_discounts_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "price_list_category_discounts"
        ADD CONSTRAINT "price_list_category_discounts_priceListId_fkey"
        FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "price_list_category_discounts"
        ADD CONSTRAINT "price_list_category_discounts_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
