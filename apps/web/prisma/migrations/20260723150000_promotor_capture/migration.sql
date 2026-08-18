-- AlterTable: imagem do código de ação por indústria
ALTER TABLE "suppliers" ADD COLUMN "actionCodeImage" TEXT;

-- AlterTable: metadados de captura do promotor (geo + snapshot do nome)
ALTER TABLE "pdv_photos"
  ADD COLUMN "promoterName" TEXT,
  ADD COLUMN "capturedCity" TEXT,
  ADD COLUMN "capturedState" TEXT,
  ADD COLUMN "capturedLatitude" DOUBLE PRECISION,
  ADD COLUMN "capturedLongitude" DOUBLE PRECISION;

-- CreateIndex: lista "minhas fotos" do promotor
CREATE INDEX "pdv_photos_organizationId_createdById_idx" ON "pdv_photos"("organizationId", "createdById");
