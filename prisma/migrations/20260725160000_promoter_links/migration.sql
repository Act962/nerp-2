-- Vínculos do promotor: indústria e loja (aditiva)
CREATE TABLE "promoter_suppliers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "promoter_suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "promoter_stores" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "promoter_stores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promoter_suppliers_memberId_supplierId_key" ON "promoter_suppliers"("memberId", "supplierId");
CREATE INDEX "promoter_suppliers_organizationId_idx" ON "promoter_suppliers"("organizationId");
CREATE INDEX "promoter_suppliers_supplierId_idx" ON "promoter_suppliers"("supplierId");

CREATE UNIQUE INDEX "promoter_stores_memberId_storeId_key" ON "promoter_stores"("memberId", "storeId");
CREATE INDEX "promoter_stores_organizationId_idx" ON "promoter_stores"("organizationId");
CREATE INDEX "promoter_stores_storeId_idx" ON "promoter_stores"("storeId");

ALTER TABLE "promoter_suppliers" ADD CONSTRAINT "promoter_suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promoter_suppliers" ADD CONSTRAINT "promoter_suppliers_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promoter_suppliers" ADD CONSTRAINT "promoter_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promoter_stores" ADD CONSTRAINT "promoter_stores_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promoter_stores" ADD CONSTRAINT "promoter_stores_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promoter_stores" ADD CONSTRAINT "promoter_stores_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
