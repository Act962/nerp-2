-- CreateEnum
CREATE TYPE "ReceiptType" AS ENUM ('FISCAL', 'NAO_FISCAL', 'ORCAMENTO');

-- CreateEnum
CREATE TYPE "ReceiptPaper" AS ENUM ('MM80', 'MM58', 'A4');

-- CreateTable
CREATE TABLE "receipt_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ReceiptType" NOT NULL DEFAULT 'NAO_FISCAL',
    "paper" "ReceiptPaper" NOT NULL DEFAULT 'MM80',
    "blocks" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receipt_templates_organization_id_idx" ON "receipt_templates"("organization_id");

-- AddForeignKey
ALTER TABLE "receipt_templates" ADD CONSTRAINT "receipt_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

