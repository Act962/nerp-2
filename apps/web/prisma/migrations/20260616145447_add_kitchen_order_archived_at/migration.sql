-- AlterTable
ALTER TABLE "kitchen_orders" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "kitchen_orders_organizationId_archivedAt_idx" ON "kitchen_orders"("organizationId", "archivedAt");
