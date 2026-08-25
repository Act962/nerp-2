-- AlterTable
ALTER TABLE "member" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
