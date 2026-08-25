-- CreateEnum
CREATE TYPE "TradeCatalogStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "trade_catalogs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TradeCatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfKey" TEXT,
    "generatedAt" TIMESTAMP(3),
    "shareToken" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "showIndex" BOOLEAN NOT NULL DEFAULT true,
    "coverLayout" JSONB,
    "closingLayout" JSONB,
    "coverBackground" JSONB,
    "closingBackground" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_catalog_pages" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mediaTypeCode" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "photoKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rows" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_catalog_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trade_catalogs_shareToken_key" ON "trade_catalogs"("shareToken");

-- CreateIndex
CREATE INDEX "trade_catalogs_organizationId_idx" ON "trade_catalogs"("organizationId");

-- CreateIndex
CREATE INDEX "trade_catalog_pages_catalogId_order_idx" ON "trade_catalog_pages"("catalogId", "order");

-- AddForeignKey
ALTER TABLE "trade_catalogs" ADD CONSTRAINT "trade_catalogs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_catalogs" ADD CONSTRAINT "trade_catalogs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_catalog_pages" ADD CONSTRAINT "trade_catalog_pages_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "trade_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
