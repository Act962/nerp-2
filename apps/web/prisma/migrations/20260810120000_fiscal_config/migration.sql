-- CreateEnum
CREATE TYPE "FiscalEnvironment" AS ENUM ('HOMOLOGACAO', 'PRODUCAO');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('SIMPLES_NACIONAL', 'SIMPLES_MEI', 'LUCRO_PRESUMIDO', 'LUCRO_REAL');

-- CreateEnum
CREATE TYPE "FiscalProvider" AS ENUM ('FOCUS_NFE');

-- CreateEnum
CREATE TYPE "FiscalEmissionType" AS ENUM ('NORMAL', 'CONTINGENCIA_SVCAN', 'CONTINGENCIA_OFFLINE');

-- CreateTable
CREATE TABLE "fiscal_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environment" "FiscalEnvironment" NOT NULL DEFAULT 'HOMOLOGACAO',
    "cnpj" TEXT,
    "ie" TEXT,
    "ieSt" TEXT,
    "im" TEXT,
    "taxRegime" "TaxRegime" DEFAULT 'SIMPLES_NACIONAL',
    "cnae" TEXT,
    "legalName" TEXT,
    "tradeName" TEXT,
    "ufFiscal" TEXT NOT NULL DEFAULT 'PI',
    "cityCode" TEXT,
    "cityName" TEXT,
    "address" TEXT,
    "addressNumber" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "zipCode" TEXT,
    "fiscalPhone" TEXT,
    "fiscalEmail" TEXT,
    "certificate_key" TEXT,
    "certificate_password_enc" TEXT,
    "certificate_expires_at" TIMESTAMP(3),
    "certificate_filename" TEXT,
    "provider" "FiscalProvider" NOT NULL DEFAULT 'FOCUS_NFE',
    "focus_token_homolog_enc" TEXT,
    "focus_token_prod_enc" TEXT,
    "focus_empresa_id" TEXT,
    "nfce_serie" INTEGER DEFAULT 1,
    "nfce_next_number" INTEGER,
    "csc_enc" TEXT,
    "csc_id" TEXT,
    "emission_type" "FiscalEmissionType" NOT NULL DEFAULT 'NORMAL',
    "auto_print_on_emission" BOOLEAN NOT NULL DEFAULT true,
    "default_receipt_template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_configs_organizationId_key" ON "fiscal_configs"("organizationId");

-- CreateIndex
CREATE INDEX "fiscal_configs_organizationId_idx" ON "fiscal_configs"("organizationId");

-- AddForeignKey
ALTER TABLE "fiscal_configs" ADD CONSTRAINT "fiscal_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
