-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('FISICA', 'DIGITAL');

-- CreateTable
CREATE TABLE "media_types" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL DEFAULT 'FISICA',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "examples" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_types" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negotiation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_sectors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_sectors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_types_organizationId_isActive_sortOrder_idx" ON "media_types"("organizationId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "media_types_organizationId_code_key" ON "media_types"("organizationId", "code");

-- CreateIndex
CREATE INDEX "negotiation_types_organizationId_isActive_sortOrder_idx" ON "negotiation_types"("organizationId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "negotiation_types_organizationId_code_key" ON "negotiation_types"("organizationId", "code");

-- CreateIndex
CREATE INDEX "store_sectors_organizationId_isActive_sortOrder_idx" ON "store_sectors"("organizationId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "store_sectors_organizationId_code_key" ON "store_sectors"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "media_types" ADD CONSTRAINT "media_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_types" ADD CONSTRAINT "negotiation_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_sectors" ADD CONSTRAINT "store_sectors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

