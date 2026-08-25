/*
  Warnings:

  - You are about to drop the column `bannerImage` on the `catalog_settings` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[clientId]` on the table `customers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "catalog_settings" DROP COLUMN "bannerImage",
ADD COLUMN     "bannerImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "logo" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "customers_clientId_key" ON "customers"("clientId");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "catalog_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
