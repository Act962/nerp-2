-- AlterTable
ALTER TABLE "pdv_photos" ADD COLUMN     "mediaTypeId" TEXT;

-- CreateIndex
CREATE INDEX "pdv_photos_organizationId_mediaTypeId_idx" ON "pdv_photos"("organizationId", "mediaTypeId");

-- AddForeignKey
ALTER TABLE "pdv_photos" ADD CONSTRAINT "pdv_photos_mediaTypeId_fkey" FOREIGN KEY ("mediaTypeId") REFERENCES "media_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
