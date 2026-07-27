-- CreateEnum
CREATE TYPE "TradePlanTier" AS ENUM ('BRONZE', 'PRATA', 'OURO');

-- CreateEnum
CREATE TYPE "TradeSubscriptionStatus" AS ENUM ('ATIVA', 'CORTESIA', 'INADIMPLENTE', 'CANCELADA');

-- CreateTable
CREATE TABLE "trade_subscriptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plan" "TradePlanTier" NOT NULL,
    "status" "TradeSubscriptionStatus" NOT NULL DEFAULT 'CORTESIA',
    "currentPeriodEnd" TIMESTAMP(3),
    "provider" TEXT,
    "externalId" TEXT,
    "extraUsers" INTEGER NOT NULL DEFAULT 0,
    "extraPromoters" INTEGER NOT NULL DEFAULT 0,
    "extraPhotos" INTEGER NOT NULL DEFAULT 0,
    "extraStorageGb" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trade_subscriptions_organizationId_key" ON "trade_subscriptions"("organizationId");

-- AddForeignKey
ALTER TABLE "trade_subscriptions" ADD CONSTRAINT "trade_subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
