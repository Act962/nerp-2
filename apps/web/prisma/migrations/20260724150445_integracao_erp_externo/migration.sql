-- CreateEnum
CREATE TYPE "ErpConnectionKind" AS ENUM ('NATIVE', 'WINTHOR_ORACLE');

-- CreateEnum
CREATE TYPE "ErpConnectionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');

-- CreateTable
CREATE TABLE "erp_connections" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "ErpConnectionKind" NOT NULL DEFAULT 'NATIVE',
    "status" "ErpConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "configCiphertext" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_sellers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branchCode" TEXT,
    "supervisorCode" TEXT,
    "isBucket" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "memberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_facts_daily" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sellerExternalCode" TEXT NOT NULL,
    "branchCode" TEXT,
    "revenue" DECIMAL(15,2) NOT NULL,
    "cost" DECIMAL(15,2) NOT NULL,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "customers" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_facts_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "erp_connections_organizationId_key" ON "erp_connections"("organizationId");

-- CreateIndex
CREATE INDEX "external_sellers_organizationId_idx" ON "external_sellers"("organizationId");

-- CreateIndex
CREATE INDEX "external_sellers_memberId_idx" ON "external_sellers"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "external_sellers_organizationId_externalCode_key" ON "external_sellers"("organizationId", "externalCode");

-- CreateIndex
CREATE INDEX "sales_facts_daily_organizationId_date_idx" ON "sales_facts_daily"("organizationId", "date");

-- CreateIndex
CREATE INDEX "sales_facts_daily_organizationId_sellerExternalCode_idx" ON "sales_facts_daily"("organizationId", "sellerExternalCode");

-- CreateIndex
CREATE UNIQUE INDEX "sales_facts_daily_organizationId_date_sellerExternalCode_key" ON "sales_facts_daily"("organizationId", "date", "sellerExternalCode");

-- AddForeignKey
ALTER TABLE "erp_connections" ADD CONSTRAINT "erp_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_sellers" ADD CONSTRAINT "external_sellers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_sellers" ADD CONSTRAINT "external_sellers_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_facts_daily" ADD CONSTRAINT "sales_facts_daily_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
