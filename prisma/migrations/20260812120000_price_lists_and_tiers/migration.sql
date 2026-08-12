-- Tabelas de preço por tipo de cliente + faixas por quantidade
-- (Varejo / Atacado / Revendedor + customizadas)

-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('FIXED', 'PERCENT_DISCOUNT');

-- CreateTable: PriceList (tabelas de preço da org)
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProductPrice (faixa de preço de um produto numa tabela)
CREATE TABLE "product_prices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "pricingMode" "PricingMode" NOT NULL DEFAULT 'FIXED',
    "unitPrice" DECIMAL(10,2),
    "percentDiscount" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

-- Índices PriceList
CREATE UNIQUE INDEX "price_lists_organizationId_slug_key" ON "price_lists"("organizationId", "slug");
CREATE INDEX "price_lists_organizationId_idx" ON "price_lists"("organizationId");
CREATE INDEX "price_lists_organizationId_isDefault_idx" ON "price_lists"("organizationId", "isDefault");

-- Índices ProductPrice
CREATE UNIQUE INDEX "product_prices_productId_priceListId_minQuantity_key" ON "product_prices"("productId", "priceListId", "minQuantity");
CREATE INDEX "product_prices_organizationId_idx" ON "product_prices"("organizationId");
CREATE INDEX "product_prices_productId_priceListId_idx" ON "product_prices"("productId", "priceListId");

-- Backstop: garante coerência do modo com o valor (defesa contra bugs no handler)
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_pricing_mode_check"
  CHECK (
    ("pricingMode" = 'FIXED' AND "unitPrice" IS NOT NULL AND "percentDiscount" IS NULL)
    OR
    ("pricingMode" = 'PERCENT_DISCOUNT' AND "percentDiscount" IS NOT NULL AND "unitPrice" IS NULL AND "percentDiscount" > 0 AND "percentDiscount" <= 100)
  );

-- FKs PriceList → Organization
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FKs ProductPrice
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_priceListId_fkey"
  FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Customer.priceListId
ALTER TABLE "customers" ADD COLUMN "priceListId" TEXT;
CREATE INDEX "customers_priceListId_idx" ON "customers"("priceListId");
ALTER TABLE "customers" ADD CONSTRAINT "customers_priceListId_fkey"
  FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CatalogUser.priceListId
ALTER TABLE "catalog_users" ADD COLUMN "priceListId" TEXT;
CREATE INDEX "catalog_users_priceListId_idx" ON "catalog_users"("priceListId");
ALTER TABLE "catalog_users" ADD CONSTRAINT "catalog_users_priceListId_fkey"
  FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sale.priceListId (auditoria)
ALTER TABLE "sales" ADD COLUMN "priceListId" TEXT;
CREATE INDEX "sales_priceListId_idx" ON "sales"("priceListId");
ALTER TABLE "sales" ADD CONSTRAINT "sales_priceListId_fkey"
  FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: cria 3 tabelas default (Varejo/Atacado/Revendedor) para cada org
-- existente. `varejo` nasce como default.
INSERT INTO "price_lists" ("id", "organizationId", "name", "slug", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT
  'pl_' || substr(md5(random()::text || o.id || 'varejo'), 1, 24),
  o.id,
  'Varejo',
  'varejo',
  true,
  true,
  NOW(),
  NOW()
FROM "organizations" o
ON CONFLICT ("organizationId", "slug") DO NOTHING;

INSERT INTO "price_lists" ("id", "organizationId", "name", "slug", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT
  'pl_' || substr(md5(random()::text || o.id || 'atacado'), 1, 24),
  o.id,
  'Atacado',
  'atacado',
  false,
  true,
  NOW(),
  NOW()
FROM "organizations" o
ON CONFLICT ("organizationId", "slug") DO NOTHING;

INSERT INTO "price_lists" ("id", "organizationId", "name", "slug", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT
  'pl_' || substr(md5(random()::text || o.id || 'revendedor'), 1, 24),
  o.id,
  'Revendedor',
  'revendedor',
  false,
  true,
  NOW(),
  NOW()
FROM "organizations" o
ON CONFLICT ("organizationId", "slug") DO NOTHING;
