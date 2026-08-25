-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('SUPERMERCADO', 'INDUSTRIA', 'DISTRIBUIDOR');

-- CreateEnum
CREATE TYPE "CompanySource" AS ENUM ('SEED', 'IMPORTACAO', 'USUARIO');

-- CreateEnum
CREATE TYPE "CompanyClaimStatus" AS ENUM ('APROVADA', 'PENDENTE', 'CONTESTADA', 'REJEITADA');

-- CreateTable
CREATE TABLE "directory_companies" (
    "id" TEXT NOT NULL,
    "type" "CompanyType" NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "document" TEXT,
    "city" TEXT,
    "state" TEXT,
    "logoKey" TEXT,
    "website" TEXT,
    "source" "CompanySource" NOT NULL DEFAULT 'USUARIO',
    "claimedByOrgId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directory_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_claims" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "status" "CompanyClaimStatus" NOT NULL DEFAULT 'APROVADA',
    "claimantRole" TEXT,
    "contactEmail" TEXT,
    "document" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "company_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "directory_companies_document_key" ON "directory_companies"("document");

-- CreateIndex
CREATE INDEX "directory_companies_type_idx" ON "directory_companies"("type");

-- CreateIndex
CREATE INDEX "directory_companies_claimedByOrgId_idx" ON "directory_companies"("claimedByOrgId");

-- CreateIndex
CREATE INDEX "company_claims_companyId_idx" ON "company_claims"("companyId");

-- CreateIndex
CREATE INDEX "company_claims_organizationId_idx" ON "company_claims"("organizationId");

-- AddForeignKey
ALTER TABLE "directory_companies" ADD CONSTRAINT "directory_companies_claimedByOrgId_fkey" FOREIGN KEY ("claimedByOrgId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_claims" ADD CONSTRAINT "company_claims_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "directory_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_claims" ADD CONSTRAINT "company_claims_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_claims" ADD CONSTRAINT "company_claims_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
