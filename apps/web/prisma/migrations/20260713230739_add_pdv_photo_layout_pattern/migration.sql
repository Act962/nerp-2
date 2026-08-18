-- CreateEnum
CREATE TYPE "PdvPhotoLayoutPattern" AS ENUM ('PATTERN_1', 'PATTERN_2', 'PATTERN_3', 'PATTERN_4');

-- AlterTable
ALTER TABLE "pdv_photos" ADD COLUMN     "photoLayout" "PdvPhotoLayoutPattern";
