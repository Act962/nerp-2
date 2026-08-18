-- AlterTable
ALTER TABLE "sales" ADD COLUMN "clientOperationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sales_clientOperationId_key" ON "sales"("clientOperationId");
