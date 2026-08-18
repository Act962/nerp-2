-- CreateEnum
CREATE TYPE "MediaPricingBasis" AS ENUM ('AREA', 'FLAT');

-- AlterTable
ALTER TABLE "media_types" ADD COLUMN     "basePrice" DECIMAL(12,2),
ADD COLUMN     "notionalAreaM2" DOUBLE PRECISION DEFAULT 1,
ADD COLUMN     "pricingBasis" "MediaPricingBasis" NOT NULL DEFAULT 'AREA';

-- CreateTable
CREATE TABLE "media_type_prices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "mediaTypeId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "isManual" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_type_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_pricing_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "markup" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "floorPrice" DECIMAL(12,2),
    "tierMultipliers" JSONB NOT NULL DEFAULT '{"PREMIUM":1.5,"OURO":1.2,"PRATA":1,"BRONZE":0.8}',
    "flowMultipliers" JSONB NOT NULL DEFAULT '{"MUITO_ALTO":1.4,"ALTO":1.15,"MEDIO":1,"BAIXO":0.85}',
    "visibilityMultipliers" JSONB NOT NULL DEFAULT '{"EXCELENTE":1.2,"BOA":1,"REGULAR":0.85}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_pricing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "region_cost_benchmarks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "costPerM2" DECIMAL(12,2) NOT NULL,
    "source" TEXT,
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "region_cost_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_type_prices_organizationId_idx" ON "media_type_prices"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "media_type_prices_storeId_mediaTypeId_key" ON "media_type_prices"("storeId", "mediaTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "trade_pricing_settings_organizationId_key" ON "trade_pricing_settings"("organizationId");

-- CreateIndex
CREATE INDEX "region_cost_benchmarks_organizationId_idx" ON "region_cost_benchmarks"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "region_cost_benchmarks_organizationId_state_city_key" ON "region_cost_benchmarks"("organizationId", "state", "city");

-- AddForeignKey
ALTER TABLE "media_type_prices" ADD CONSTRAINT "media_type_prices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_type_prices" ADD CONSTRAINT "media_type_prices_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_type_prices" ADD CONSTRAINT "media_type_prices_mediaTypeId_fkey" FOREIGN KEY ("mediaTypeId") REFERENCES "media_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_pricing_settings" ADD CONSTRAINT "trade_pricing_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "region_cost_benchmarks" ADD CONSTRAINT "region_cost_benchmarks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
