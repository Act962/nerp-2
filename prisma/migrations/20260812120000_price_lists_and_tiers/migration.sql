-- Tabelas de preço por tipo de cliente + faixas por quantidade
-- (Varejo / Atacado / Revendedor + customizadas)
--
-- DDL idempotente: a primeira execução desta migration falhou em produção
-- (referenciava "organizations", o @@map correto é "organization"), então
-- ela precisa aplicar limpo tanto num banco virgem quanto num que tenha
-- ficado com estado parcial.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PricingMode" AS ENUM ('FIXED', 'PERCENT_DISCOUNT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: PriceList (tabelas de preço da org)
CREATE TABLE IF NOT EXISTS "price_lists" (
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
CREATE TABLE IF NOT EXISTS "product_prices" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "price_lists_organizationId_slug_key" ON "price_lists"("organizationId", "slug");
CREATE INDEX IF NOT EXISTS "price_lists_organizationId_idx" ON "price_lists"("organizationId");
CREATE INDEX IF NOT EXISTS "price_lists_organizationId_isDefault_idx" ON "price_lists"("organizationId", "isDefault");

-- Índices ProductPrice
CREATE UNIQUE INDEX IF NOT EXISTS "product_prices_productId_priceListId_minQuantity_key" ON "product_prices"("productId", "priceListId", "minQuantity");
CREATE INDEX IF NOT EXISTS "product_prices_organizationId_idx" ON "product_prices"("organizationId");
CREATE INDEX IF NOT EXISTS "product_prices_productId_priceListId_idx" ON "product_prices"("productId", "priceListId");

-- Backstop: garante coerência do modo com o valor (defesa contra bugs no handler)
DO $$ BEGIN
  ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_pricing_mode_check"
    CHECK (
      ("pricingMode" = 'FIXED' AND "unitPrice" IS NOT NULL AND "percentDiscount" IS NULL)
      OR
      ("pricingMode" = 'PERCENT_DISCOUNT' AND "percentDiscount" IS NOT NULL AND "unitPrice" IS NULL AND "percentDiscount" > 0 AND "percentDiscount" <= 100)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FKs PriceList → Organization
DO $$ BEGIN
  ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FKs ProductPrice
DO $$ BEGIN
  ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_priceListId_fkey"
    FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Customer.priceListId
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "priceListId" TEXT;
CREATE INDEX IF NOT EXISTS "customers_priceListId_idx" ON "customers"("priceListId");
DO $$ BEGIN
  ALTER TABLE "customers" ADD CONSTRAINT "customers_priceListId_fkey"
    FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CatalogUser.priceListId
ALTER TABLE "catalog_users" ADD COLUMN IF NOT EXISTS "priceListId" TEXT;
CREATE INDEX IF NOT EXISTS "catalog_users_priceListId_idx" ON "catalog_users"("priceListId");
DO $$ BEGIN
  ALTER TABLE "catalog_users" ADD CONSTRAINT "catalog_users_priceListId_fkey"
    FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Sale.priceListId (auditoria)
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "priceListId" TEXT;
CREATE INDEX IF NOT EXISTS "sales_priceListId_idx" ON "sales"("priceListId");
DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "sales_priceListId_fkey"
    FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
FROM "organization" o
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
FROM "organization" o
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
FROM "organization" o
ON CONFLICT ("organizationId", "slug") DO NOTHING;
