-- CreateTable
CREATE TABLE "distributors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "logo" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributor_industries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distributor_industries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_distributors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_distributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promoter_distributors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promoter_distributors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "distributors_organizationId_idx" ON "distributors"("organizationId");

-- CreateIndex
CREATE INDEX "distributor_industries_organizationId_idx" ON "distributor_industries"("organizationId");

-- CreateIndex
CREATE INDEX "distributor_industries_supplierId_idx" ON "distributor_industries"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "distributor_industries_distributorId_supplierId_key" ON "distributor_industries"("distributorId", "supplierId");

-- CreateIndex
CREATE INDEX "store_distributors_organizationId_idx" ON "store_distributors"("organizationId");

-- CreateIndex
CREATE INDEX "store_distributors_distributorId_idx" ON "store_distributors"("distributorId");

-- CreateIndex
CREATE UNIQUE INDEX "store_distributors_storeId_distributorId_key" ON "store_distributors"("storeId", "distributorId");

-- CreateIndex
CREATE INDEX "promoter_distributors_organizationId_idx" ON "promoter_distributors"("organizationId");

-- CreateIndex
CREATE INDEX "promoter_distributors_distributorId_idx" ON "promoter_distributors"("distributorId");

-- CreateIndex
CREATE UNIQUE INDEX "promoter_distributors_memberId_distributorId_key" ON "promoter_distributors"("memberId", "distributorId");

-- AddForeignKey
ALTER TABLE "distributors" ADD CONSTRAINT "distributors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_industries" ADD CONSTRAINT "distributor_industries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_industries" ADD CONSTRAINT "distributor_industries_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributor_industries" ADD CONSTRAINT "distributor_industries_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_distributors" ADD CONSTRAINT "store_distributors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_distributors" ADD CONSTRAINT "store_distributors_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_distributors" ADD CONSTRAINT "store_distributors_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter_distributors" ADD CONSTRAINT "promoter_distributors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter_distributors" ADD CONSTRAINT "promoter_distributors_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter_distributors" ADD CONSTRAINT "promoter_distributors_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "distributors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
