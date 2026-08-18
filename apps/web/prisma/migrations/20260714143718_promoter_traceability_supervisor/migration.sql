-- AlterTable
ALTER TABLE "map_objects" ADD COLUMN     "lastEditedById" TEXT;

-- AlterTable
ALTER TABLE "member" ADD COLUMN     "supervisorId" TEXT;

-- CreateIndex
CREATE INDEX "map_objects_lastEditedById_idx" ON "map_objects"("lastEditedById");

-- CreateIndex
CREATE INDEX "member_supervisorId_idx" ON "member"("supervisorId");

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_objects" ADD CONSTRAINT "map_objects_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
