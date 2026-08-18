-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_createdById_fkey";

-- AlterTable
ALTER TABLE "sales" ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
