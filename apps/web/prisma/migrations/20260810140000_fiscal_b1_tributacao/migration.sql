-- Idempotente: este schema já existe em bancos que o receberam à mão, sem a
-- linha correspondente no _prisma_migrations. As guardas deixam o
-- `migrate deploy` registrar a migração sem tentar recriar o que já está lá.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FiscalDocumentType" AS ENUM ('NFCE', 'NFE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FiscalDocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'AUTHORIZED', 'REJECTED', 'CANCELLED', 'DENIED', 'CONTINGENCY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable: cadastro tributário nos produtos (todos opcionais)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cest" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cfop" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "origem" TEXT DEFAULT '0';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cstIcms" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cstPis" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cstCofins" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "aliqIcms" DECIMAL(5,2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "aliqPis" DECIMAL(5,2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "aliqCofins" DECIMAL(5,2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cClassTrib" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "fiscal_documents" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_documents_saleId_key" ON "fiscal_documents"("saleId");
CREATE INDEX IF NOT EXISTS "fiscal_documents_organizationId_idx" ON "fiscal_documents"("organizationId");
CREATE INDEX IF NOT EXISTS "fiscal_documents_status_idx" ON "fiscal_documents"("status");
CREATE INDEX IF NOT EXISTS "fiscal_documents_chave_idx" ON "fiscal_documents"("chave");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
