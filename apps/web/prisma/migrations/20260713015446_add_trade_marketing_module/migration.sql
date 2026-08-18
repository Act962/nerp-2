-- CreateEnum
CREATE TYPE "MapObjectType" AS ENUM ('WALL', 'AISLE', 'SECTOR', 'GONDOLA', 'ISLAND', 'CHECKOUT', 'ENTRANCE', 'EXIT', 'DEPOSIT', 'RESTRICTED_AREA', 'PIN', 'TEXT');

-- CreateEnum
CREATE TYPE "MapShapeKind" AS ENUM ('RECT', 'POLYGON', 'POLYLINE', 'POINT');

-- CreateEnum
CREATE TYPE "MapAnnotationType" AS ENUM ('PIN', 'COMMENT', 'ALERT', 'PENDING');

-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "managerName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "widthM" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "heightM" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "pixelsPerMeter" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "backgroundImageKey" TEXT,
    "backgroundOpacity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "backgroundTransform" JSONB,
    "defaultViewport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "floor_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_layers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "floorPlanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "map_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_objects" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "floorPlanId" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,
    "type" "MapObjectType" NOT NULL,
    "shapeKind" "MapShapeKind" NOT NULL DEFAULT 'RECT',
    "geometry" JSONB NOT NULL,
    "z" INTEGER NOT NULL DEFAULT 0,
    "heightM" DOUBLE PRECISION,
    "style" JSONB,
    "name" TEXT,
    "status" TEXT,
    "category" TEXT,
    "responsibleName" TEXT,
    "lastVisitAt" TIMESTAMP(3),
    "properties" JSONB,
    "supplierId" TEXT,
    "brandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "map_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdv_photos" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "mapObjectId" TEXT,
    "supplierId" TEXT,
    "section" TEXT,
    "responsibleCompany" TEXT,
    "coordinatorName" TEXT,
    "consultantName" TEXT,
    "code" TEXT,
    "photos" TEXT[],
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdv_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "distributorLogo" TEXT,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "status" "BookStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfKey" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_items" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "pdvPhotoId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_annotations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "floorPlanId" TEXT NOT NULL,
    "mapObjectId" TEXT,
    "type" "MapAnnotationType" NOT NULL DEFAULT 'PIN',
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "text" TEXT,
    "status" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "map_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stores_organizationId_idx" ON "stores"("organizationId");

-- CreateIndex
CREATE INDEX "floor_plans_organizationId_idx" ON "floor_plans"("organizationId");

-- CreateIndex
CREATE INDEX "floor_plans_storeId_idx" ON "floor_plans"("storeId");

-- CreateIndex
CREATE INDEX "map_layers_organizationId_idx" ON "map_layers"("organizationId");

-- CreateIndex
CREATE INDEX "map_layers_floorPlanId_idx" ON "map_layers"("floorPlanId");

-- CreateIndex
CREATE INDEX "map_objects_organizationId_idx" ON "map_objects"("organizationId");

-- CreateIndex
CREATE INDEX "map_objects_floorPlanId_idx" ON "map_objects"("floorPlanId");

-- CreateIndex
CREATE INDEX "map_objects_floorPlanId_layerId_idx" ON "map_objects"("floorPlanId", "layerId");

-- CreateIndex
CREATE INDEX "map_objects_supplierId_idx" ON "map_objects"("supplierId");

-- CreateIndex
CREATE INDEX "map_objects_brandId_idx" ON "map_objects"("brandId");

-- CreateIndex
CREATE INDEX "brands_organizationId_idx" ON "brands"("organizationId");

-- CreateIndex
CREATE INDEX "brands_supplierId_idx" ON "brands"("supplierId");

-- CreateIndex
CREATE INDEX "pdv_photos_organizationId_idx" ON "pdv_photos"("organizationId");

-- CreateIndex
CREATE INDEX "pdv_photos_organizationId_storeId_idx" ON "pdv_photos"("organizationId", "storeId");

-- CreateIndex
CREATE INDEX "pdv_photos_mapObjectId_idx" ON "pdv_photos"("mapObjectId");

-- CreateIndex
CREATE INDEX "pdv_photos_organizationId_code_idx" ON "pdv_photos"("organizationId", "code");

-- CreateIndex
CREATE INDEX "pdv_photos_organizationId_supplierId_idx" ON "pdv_photos"("organizationId", "supplierId");

-- CreateIndex
CREATE INDEX "books_organizationId_idx" ON "books"("organizationId");

-- CreateIndex
CREATE INDEX "books_supplierId_idx" ON "books"("supplierId");

-- CreateIndex
CREATE INDEX "book_items_bookId_idx" ON "book_items"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "book_items_bookId_pdvPhotoId_key" ON "book_items"("bookId", "pdvPhotoId");

-- CreateIndex
CREATE INDEX "map_annotations_organizationId_idx" ON "map_annotations"("organizationId");

-- CreateIndex
CREATE INDEX "map_annotations_floorPlanId_idx" ON "map_annotations"("floorPlanId");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_layers" ADD CONSTRAINT "map_layers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_layers" ADD CONSTRAINT "map_layers_floorPlanId_fkey" FOREIGN KEY ("floorPlanId") REFERENCES "floor_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_objects" ADD CONSTRAINT "map_objects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_objects" ADD CONSTRAINT "map_objects_floorPlanId_fkey" FOREIGN KEY ("floorPlanId") REFERENCES "floor_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_objects" ADD CONSTRAINT "map_objects_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "map_layers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_objects" ADD CONSTRAINT "map_objects_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_objects" ADD CONSTRAINT "map_objects_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdv_photos" ADD CONSTRAINT "pdv_photos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdv_photos" ADD CONSTRAINT "pdv_photos_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdv_photos" ADD CONSTRAINT "pdv_photos_mapObjectId_fkey" FOREIGN KEY ("mapObjectId") REFERENCES "map_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdv_photos" ADD CONSTRAINT "pdv_photos_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdv_photos" ADD CONSTRAINT "pdv_photos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_items" ADD CONSTRAINT "book_items_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_items" ADD CONSTRAINT "book_items_pdvPhotoId_fkey" FOREIGN KEY ("pdvPhotoId") REFERENCES "pdv_photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_annotations" ADD CONSTRAINT "map_annotations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_annotations" ADD CONSTRAINT "map_annotations_floorPlanId_fkey" FOREIGN KEY ("floorPlanId") REFERENCES "floor_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_annotations" ADD CONSTRAINT "map_annotations_mapObjectId_fkey" FOREIGN KEY ("mapObjectId") REFERENCES "map_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_annotations" ADD CONSTRAINT "map_annotations_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
