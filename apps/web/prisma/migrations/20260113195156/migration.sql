/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,email]` on the table `customers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "customers_organizationId_email_key" ON "customers"("organizationId", "email");
