-- CreateEnum
CREATE TYPE "PlanogramStatus" AS ENUM ('RASCUNHO', 'EM_APROVACAO', 'ATIVO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "FixtureKind" AS ENUM ('GONDOLA', 'PONTA_GONDOLA', 'ILHA', 'CHECKOUT', 'GELADEIRA', 'EXPOSITOR', 'CLIP_STRIP');

-- CreateEnum
CREATE TYPE "ShelfKind" AS ENUM ('PRATELEIRA', 'GANCHEIRA', 'CESTO', 'CAIXARIA');

-- CreateEnum
CREATE TYPE "ShelfLayoutMode" AS ENUM ('PACKED', 'FREE');

-- CreateEnum
CREATE TYPE "ItemOrientation" AS ENUM ('FRENTE', 'LADO', 'TOPO');

-- CreateTable
CREATE TABLE "planograms" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "categoryId" TEXT,
    "status" "PlanogramStatus" NOT NULL DEFAULT 'RASCUNHO',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "releaseAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "decisionTree" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planograms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planogram_fixtures" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planogramId" TEXT NOT NULL,
    "kind" "FixtureKind" NOT NULL DEFAULT 'GONDOLA',
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "widthMm" INTEGER NOT NULL DEFAULT 1300,
    "heightMm" INTEGER NOT NULL DEFAULT 1900,
    "depthMm" INTEGER NOT NULL DEFAULT 400,
    "baseHeightMm" INTEGER NOT NULL DEFAULT 100,
    "colorHex" TEXT,
    "mapObjectId" TEXT,

    CONSTRAINT "planogram_fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planogram_modules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "widthMm" INTEGER NOT NULL DEFAULT 1300,
    "label" TEXT,

    CONSTRAINT "planogram_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planogram_shelves" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "yMm" INTEGER NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "depthMm" INTEGER NOT NULL,
    "thicknessMm" INTEGER NOT NULL DEFAULT 25,
    "kind" "ShelfKind" NOT NULL DEFAULT 'PRATELEIRA',
    "layoutMode" "ShelfLayoutMode" NOT NULL DEFAULT 'PACKED',
    "maxWeightKg" DOUBLE PRECISION,
    "dividers" JSONB,

    CONSTRAINT "planogram_shelves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planogram_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planogramId" TEXT NOT NULL,
    "shelfId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "xMm" INTEGER,
    "facings" INTEGER NOT NULL DEFAULT 1,
    "facingsDeep" INTEGER NOT NULL DEFAULT 1,
    "facingsHigh" INTEGER NOT NULL DEFAULT 1,
    "orientation" "ItemOrientation" NOT NULL DEFAULT 'FRENTE',
    "isBoxed" BOOLEAN NOT NULL DEFAULT false,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "depthMm" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "planogram_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planogram_versions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planogramId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "snapshot" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "facingCount" INTEGER NOT NULL DEFAULT 0,
    "linearMm" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planogram_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "planograms_organizationId_status_idx" ON "planograms"("organizationId", "status");

-- CreateIndex
CREATE INDEX "planograms_organizationId_categoryId_idx" ON "planograms"("organizationId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "planograms_organizationId_code_key" ON "planograms"("organizationId", "code");

-- CreateIndex
CREATE INDEX "planogram_fixtures_planogramId_order_idx" ON "planogram_fixtures"("planogramId", "order");

-- CreateIndex
CREATE INDEX "planogram_fixtures_organizationId_idx" ON "planogram_fixtures"("organizationId");

-- CreateIndex
CREATE INDEX "planogram_modules_organizationId_idx" ON "planogram_modules"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "planogram_modules_fixtureId_index_key" ON "planogram_modules"("fixtureId", "index");

-- CreateIndex
CREATE INDEX "planogram_shelves_organizationId_idx" ON "planogram_shelves"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "planogram_shelves_moduleId_index_key" ON "planogram_shelves"("moduleId", "index");

-- CreateIndex
CREATE INDEX "planogram_items_planogramId_productId_idx" ON "planogram_items"("planogramId", "productId");

-- CreateIndex
CREATE INDEX "planogram_items_organizationId_productId_idx" ON "planogram_items"("organizationId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "planogram_items_shelfId_position_key" ON "planogram_items"("shelfId", "position");

-- CreateIndex
CREATE INDEX "planogram_versions_organizationId_idx" ON "planogram_versions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "planogram_versions_planogramId_version_key" ON "planogram_versions"("planogramId", "version");

-- AddForeignKey
ALTER TABLE "planograms" ADD CONSTRAINT "planograms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planograms" ADD CONSTRAINT "planograms_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planograms" ADD CONSTRAINT "planograms_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planogram_fixtures" ADD CONSTRAINT "planogram_fixtures_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planogram_fixtures" ADD CONSTRAINT "planogram_fixtures_planogramId_fkey" FOREIGN KEY ("planogramId") REFERENCES "planograms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planogram_fixtures" ADD CONSTRAINT "planogram_fixtures_mapObjectId_fkey" FOREIGN KEY ("mapObjectId") REFERENCES "map_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planogram_modules" ADD CONSTRAINT "planogram_modules_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "planogram_fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planogram_shelves" ADD CONSTRAINT "planogram_shelves_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "planogram_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planogram_items" ADD CONSTRAINT "planogram_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planogram_items" ADD CONSTRAINT "planogram_items_planogramId_fkey" FOREIGN KEY ("planogramId") REFERENCES "planograms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planogram_items" ADD CONSTRAINT "planogram_items_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "planogram_shelves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planogram_items" ADD CONSTRAINT "planogram_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planogram_versions" ADD CONSTRAINT "planogram_versions_planogramId_fkey" FOREIGN KEY ("planogramId") REFERENCES "planograms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planogram_versions" ADD CONSTRAINT "planogram_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
