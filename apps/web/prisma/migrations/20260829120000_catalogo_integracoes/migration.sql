-- Catálogo de integrações financeiras (bancos, adquirentes, gateways).
--
-- O catálogo de provedores é CÓDIGO (`src/features/integracoes/catalog`); esta
-- tabela guarda só a INSTALAÇÃO — a organização que ligou o provedor e as
-- credenciais dela. Provedor novo é um arquivo de manifesto, sem migration.
--
-- `externalRef` é NOT NULL DEFAULT '' de propósito: no Postgres dois NULL não
-- colidem, então com coluna anulável a unique não impediria instalar o mesmo
-- provedor duas vezes na mesma organização.
--
-- IF NOT EXISTS porque o `migrate deploy` desta base já esteve bloqueado por
-- migração falha anterior (P3009) e as recentes são aplicadas à mão.
DO $$ BEGIN
  CREATE TYPE "IntegrationCategory" AS ENUM ('BANCO', 'ADQUIRENTE', 'GATEWAY', 'ERP', 'FISCAL', 'PRODUTIVIDADE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR', 'PENDING_AUTH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "financial_integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "category" "IntegrationCategory" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "credentialsCiphertext" TEXT,
    "certificateKey" TEXT,
    "certificateExpiresAt" TIMESTAMP(3),
    "environment" TEXT NOT NULL DEFAULT 'producao',
    "externalRef" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT,
    "capabilities" TEXT[],
    "bankAccountId" TEXT,
    "installedById" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_integrations_pkey" PRIMARY KEY ("id")
);

-- Uma instalação por provedor+conta dentro da organização.
CREATE UNIQUE INDEX IF NOT EXISTS "financial_integrations_organizationId_providerId_externalRef_key"
  ON "financial_integrations"("organizationId", "providerId", "externalRef");
CREATE INDEX IF NOT EXISTS "financial_integrations_organizationId_idx"
  ON "financial_integrations"("organizationId");
CREATE INDEX IF NOT EXISTS "financial_integrations_bankAccountId_idx"
  ON "financial_integrations"("bankAccountId");

DO $$ BEGIN
  ALTER TABLE "financial_integrations" ADD CONSTRAINT "financial_integrations_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "financial_integrations" ADD CONSTRAINT "financial_integrations_installedById_fkey"
    FOREIGN KEY ("installedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "financial_integrations" ADD CONSTRAINT "financial_integrations_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "payment_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
