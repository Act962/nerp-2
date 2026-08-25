-- CreateEnum
CREATE TYPE "TradeRole" AS ENUM ('COORDENADOR_TRADE', 'SUPERVISOR');

-- AlterTable
ALTER TABLE "member" ADD COLUMN     "tradeRole" "TradeRole",
ADD COLUMN     "showInPromotorPhoto" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "invitation" ADD COLUMN     "tradeRole" "TradeRole";
