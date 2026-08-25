-- AlterTable
ALTER TABLE "space_negotiations" ADD COLUMN     "negotiationTypeId" TEXT;

-- CreateIndex
CREATE INDEX "space_negotiations_organizationId_negotiationTypeId_idx" ON "space_negotiations"("organizationId", "negotiationTypeId");

-- AddForeignKey
ALTER TABLE "space_negotiations" ADD CONSTRAINT "space_negotiations_negotiationTypeId_fkey" FOREIGN KEY ("negotiationTypeId") REFERENCES "negotiation_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
