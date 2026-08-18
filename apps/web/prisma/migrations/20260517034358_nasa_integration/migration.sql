-- CreateTable
CREATE TABLE "nasa_integration_consents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nerpOrgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopes" TEXT[],
    "redirectUri" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasa_integration_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_integration_keys" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "secretCiphertext" TEXT NOT NULL,
    "scopes" TEXT[],
    "consentByUserId" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasa_integration_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nasa_integration_consents_code_key" ON "nasa_integration_consents"("code");

-- CreateIndex
CREATE INDEX "nasa_integration_consents_code_idx" ON "nasa_integration_consents"("code");

-- CreateIndex
CREATE INDEX "nasa_integration_consents_expiresAt_idx" ON "nasa_integration_consents"("expiresAt");

-- CreateIndex
CREATE INDEX "nasa_integration_consents_nerpOrgId_idx" ON "nasa_integration_consents"("nerpOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_integration_keys_apiKey_key" ON "nasa_integration_keys"("apiKey");

-- CreateIndex
CREATE INDEX "nasa_integration_keys_organizationId_idx" ON "nasa_integration_keys"("organizationId");

-- CreateIndex
CREATE INDEX "nasa_integration_keys_apiKey_idx" ON "nasa_integration_keys"("apiKey");

-- AddForeignKey
ALTER TABLE "nasa_integration_consents" ADD CONSTRAINT "nasa_integration_consents_nerpOrgId_fkey" FOREIGN KEY ("nerpOrgId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_integration_keys" ADD CONSTRAINT "nasa_integration_keys_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
