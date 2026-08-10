-- CreateEnum
CREATE TYPE "PhotoLocationStatus" AS ENUM ('OK', 'DENIED', 'UNAVAILABLE', 'TIMEOUT', 'UNKNOWN');

-- AlterTable
ALTER TABLE "pdv_photos" ADD COLUMN "capturedAccuracy" DOUBLE PRECISION;
ALTER TABLE "pdv_photos" ADD COLUMN "locationStatus" "PhotoLocationStatus" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "member" ADD COLUMN "lastGeoState" TEXT;
ALTER TABLE "member" ADD COLUMN "lastGeoStateAt" TIMESTAMP(3);
