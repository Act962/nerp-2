-- CreateEnum
CREATE TYPE "FiscalDocumentType" AS ENUM ('NFCE', 'NFE');

-- CreateEnum
CREATE TYPE "FiscalDocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'AUTHORIZED', 'REJECTED', 'CANCELLED', 'DENIED', 'CONTINGENCY');

-- AlterTable: cadastro tributário nos produtos (todos opcionais)
ALTER TABLE "products" ADD COLUMN "cest" TEXT;
ALTER TABLE "products" ADD COLUMN "cfop" TEXT;
ALTER TABLE "products" ADD COLUMN "origem" TEXT DEFAULT '0';
ALTER TABLE "products" ADD COLUMN "cstIcms" TEXT;
ALTER TABLE "products" ADD COLUMN "cstPis" TEXT;
ALTER TABLE "products" ADD COLUMN "cstCofins" TEXT;
ALTER TABLE "products" ADD COLUMN "aliqIcms" DECIMAL(5,2);
ALTER TABLE "products" ADD COLUMN "aliqPis" DECIMAL(5,2);
ALTER TABLE "products" ADD COLUMN "aliqCofins" DECIMAL(5,2);
ALTER TABLE "products" ADD COLUMN "cClassTrib" TEXT;

-- CreateTable
CREATE TABLE "fiscal_documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "type" "FiscalDocumentType" NOT NULL DEFAULT 'NFCE',
    "status" "FiscalDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "environment" TEXT,
    "serie" INTEGER,
    "numero" INTEGER,
    "chave" TEXT,
    "protocolo" TEXT,
    "providerRef" TEXT,
    "xmlKey" TEXT,
    "pdfKey" TEXT,
    "rejectionCode" TEXT,
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "cancelProtocol" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "authorizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_documents_saleId_key" ON "fiscal_documents"("saleId");
CREATE INDEX "fiscal_documents_organizationId_idx" ON "fiscal_documents"("organizationId");
CREATE INDEX "fiscal_documents_status_idx" ON "fiscal_documents"("status");
CREATE INDEX "fiscal_documents_chave_idx" ON "fiscal_documents"("chave");

-- AddForeignKey
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
