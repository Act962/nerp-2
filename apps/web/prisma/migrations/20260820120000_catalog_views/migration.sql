-- CreateTable
CREATE TABLE "catalog_views" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_views_userId_catalogId_key" ON "catalog_views"("userId", "catalogId");

-- CreateIndex
CREATE INDEX "catalog_views_organizationId_idx" ON "catalog_views"("organizationId");

-- CreateIndex
CREATE INDEX "catalog_views_userId_idx" ON "catalog_views"("userId");
