-- AlterTable
ALTER TABLE "invitation" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
