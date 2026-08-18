-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED');

-- CreateTable
CREATE TABLE "shoppers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shoppers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "shopperId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT,
    "priceWhenFavorited" DECIMAL(10,2) NOT NULL,
    "notifyOnDrop" BOOLEAN NOT NULL DEFAULT true,
    "lastNotifiedPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT,
    "brandId" TEXT,
    "categoryId" TEXT,
    "funderSupplierId" TEXT,
    "title" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "minQty" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "perShopperLimit" INTEGER NOT NULL DEFAULT 1,
    "personalized" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "shopperId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shoppers_email_key" ON "shoppers"("email");

-- CreateIndex
CREATE INDEX "favorites_productId_idx" ON "favorites"("productId");

-- CreateIndex
CREATE INDEX "favorites_organizationId_productId_idx" ON "favorites"("organizationId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_shopperId_productId_key" ON "favorites"("shopperId", "productId");

-- CreateIndex
CREATE INDEX "coupons_organizationId_isActive_idx" ON "coupons"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "coupons_productId_idx" ON "coupons"("productId");

-- CreateIndex
CREATE INDEX "coupon_redemptions_couponId_idx" ON "coupon_redemptions"("couponId");

-- CreateIndex
CREATE INDEX "coupon_redemptions_shopperId_idx" ON "coupon_redemptions"("shopperId");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_shopperId_fkey" FOREIGN KEY ("shopperId") REFERENCES "shoppers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_shopperId_fkey" FOREIGN KEY ("shopperId") REFERENCES "shoppers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
