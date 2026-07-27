-- AlterTable
ALTER TABLE "sales_facts_daily" ADD COLUMN     "costPipeline" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "customersPipeline" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ordersPipeline" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "revenuePipeline" DECIMAL(15,2) NOT NULL DEFAULT 0;
