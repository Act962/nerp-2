-- CreateTable
CREATE TABLE "promoter_favorite_stores" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promoter_favorite_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promoter_favorite_suppliers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promoter_favorite_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promoter_favorite_stores_organizationId_idx" ON "promoter_favorite_stores"("organizationId");

-- CreateIndex
CREATE INDEX "promoter_favorite_stores_storeId_idx" ON "promoter_favorite_stores"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "promoter_favorite_stores_memberId_storeId_key" ON "promoter_favorite_stores"("memberId", "storeId");

-- CreateIndex
CREATE INDEX "promoter_favorite_suppliers_organizationId_idx" ON "promoter_favorite_suppliers"("organizationId");

-- CreateIndex
CREATE INDEX "promoter_favorite_suppliers_supplierId_idx" ON "promoter_favorite_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "promoter_favorite_suppliers_memberId_supplierId_key" ON "promoter_favorite_suppliers"("memberId", "supplierId");

-- AddForeignKey
ALTER TABLE "promoter_favorite_stores" ADD CONSTRAINT "promoter_favorite_stores_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter_favorite_stores" ADD CONSTRAINT "promoter_favorite_stores_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter_favorite_stores" ADD CONSTRAINT "promoter_favorite_stores_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter_favorite_suppliers" ADD CONSTRAINT "promoter_favorite_suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter_favorite_suppliers" ADD CONSTRAINT "promoter_favorite_suppliers_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter_favorite_suppliers" ADD CONSTRAINT "promoter_favorite_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
