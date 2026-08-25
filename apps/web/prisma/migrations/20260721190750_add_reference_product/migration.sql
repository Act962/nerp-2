-- Catalogo global de produtos + memoria compartilhada de medidas.
-- Aditivo puro: tabelas e enums novos, e uma coluna NULAVEL em products.
-- O unico UNIQUE novo e em tabela vazia, entao nao ha risco de quebrar deploy.

CREATE TYPE "ReferenceImageStatus" AS ENUM ('PENDING', 'OK', 'SUSPECT', 'FAILED', 'SKIPPED');
CREATE TYPE "MeasurementSource" AS ENUM ('MANUAL', 'ARCHETYPE', 'IMPORT');
CREATE TYPE "ConfidenceLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');

ALTER TABLE "products" ADD COLUMN "referenceProductId" TEXT;
CREATE INDEX "products_referenceProductId_idx" ON "products"("referenceProductId");

CREATE TABLE "reference_products" (
    "id" TEXT NOT NULL,
    "gtin" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "brandName" TEXT,
    "ncm" TEXT,
    "gpcCode" TEXT,
    "categoryPath" TEXT,
    "siblingGtins" TEXT[],
    "imageKey" TEXT NOT NULL DEFAULT '',
    "imageSourceUrl" TEXT,
    "imageStatus" "ReferenceImageStatus" NOT NULL DEFAULT 'PENDING',
    "imageAttempts" INTEGER NOT NULL DEFAULT 0,
    "archetypeId" TEXT,
    "consensusWidthMm" INTEGER,
    "consensusHeightMm" INTEGER,
    "consensusDepthMm" INTEGER,
    "consensusOrgCount" INTEGER NOT NULL DEFAULT 0,
    "consensusLevel" "ConfidenceLevel" NOT NULL DEFAULT 'NONE',
    "disputed" BOOLEAN NOT NULL DEFAULT false,
    "cosmosFetchedAt" TIMESTAMP(3),
    "notFoundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reference_products_gtin_key" ON "reference_products"("gtin");
CREATE INDEX "reference_products_description_idx" ON "reference_products"("description");
CREATE INDEX "reference_products_brandName_idx" ON "reference_products"("brandName");

CREATE TABLE "reference_product_measurements" (
    "id" TEXT NOT NULL,
    "referenceProductId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "depthMm" INTEGER,
    "source" "MeasurementSource" NOT NULL DEFAULT 'MANUAL',
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_product_measurements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reference_product_measurements_referenceProductId_organizat_key" ON "reference_product_measurements"("referenceProductId", "organizationId");
CREATE INDEX "reference_product_measurements_organizationId_idx" ON "reference_product_measurements"("organizationId");

ALTER TABLE "reference_product_measurements" ADD CONSTRAINT "reference_product_measurements_referenceProductId_fkey" FOREIGN KEY ("referenceProductId") REFERENCES "reference_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reference_product_measurements" ADD CONSTRAINT "reference_product_measurements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
