-- CreateEnum
CREATE TYPE "ScanEventKind" AS ENUM ('BARCODE_SCAN', 'PRODUCT_SEARCH', 'SECTOR_VIEW', 'LOCATE', 'UNKNOWN_BARCODE');

-- CreateTable
CREATE TABLE "scan_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" "ScanEventKind" NOT NULL,
    "barcode" TEXT,
    "productId" TEXT,
    "brandId" TEXT,
    "supplierId" TEXT,
    "sectorId" TEXT,
    "query" TEXT,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "anonId" TEXT NOT NULL,
    "shopperId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scan_events_organizationId_createdAt_idx" ON "scan_events"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "scan_events_organizationId_productId_idx" ON "scan_events"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "scan_events_organizationId_storeId_createdAt_idx" ON "scan_events"("organizationId", "storeId", "createdAt");
