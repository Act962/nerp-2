/*
  Warnings:

  - You are about to drop the column `freightOptions` on the `catalog_settings` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "FreightChargeType" AS ENUM ('FIXED', 'PER_KG');

-- AlterTable
ALTER TABLE "catalog_settings" DROP COLUMN "freightOptions",
ADD COLUMN     "deliverySpecialInfo" TEXT,
ADD COLUMN     "freeShippingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "freeShippingMinValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "freightChargeType" "FreightChargeType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "freightFixedValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "freightValuePerKg" DECIMAL(10,2) NOT NULL DEFAULT 0;
