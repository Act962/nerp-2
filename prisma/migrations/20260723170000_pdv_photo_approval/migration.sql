-- AlterTable: aprovação da foto do promotor pela coordenadora
ALTER TABLE "pdv_photos"
  ADD COLUMN "approvalStatus" "BookItemApproval" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "approvalNote" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedByName" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- CreateIndex: lista "Fotos para aprovação"
CREATE INDEX "pdv_photos_organizationId_approvalStatus_idx" ON "pdv_photos"("organizationId", "approvalStatus");
