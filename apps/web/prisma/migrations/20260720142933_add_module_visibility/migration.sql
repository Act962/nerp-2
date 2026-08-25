-- AlterTable
ALTER TABLE "member" ADD COLUMN     "dashboardModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hiddenModules" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "disabledModules" TEXT[] DEFAULT ARRAY[]::TEXT[];
