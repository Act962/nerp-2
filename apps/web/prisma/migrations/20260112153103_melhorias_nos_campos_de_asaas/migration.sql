/*
  Warnings:

  - Made the column `name` on table `catalog_users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `customers` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "catalog_settings" ADD COLUMN     "wallet_id" TEXT,
ALTER COLUMN "theme" SET DEFAULT '#00bcd4';

-- AlterTable
ALTER TABLE "catalog_users" ALTER COLUMN "name" SET NOT NULL;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "asaas_customer_id" TEXT,
ALTER COLUMN "email" SET NOT NULL;
