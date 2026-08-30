-- Logo dos provedores do catálogo de integrações.
--
-- Tabela GLOBAL (sem organizationId): a marca do Banco Inter é a mesma para
-- todo inquilino. Só o super-admin escreve — ver `src/lib/super-admin.ts`.
--
-- `providerId` é a PK e casa com o id do manifesto em código; não há FK porque
-- o catálogo de provedores não é tabela.
CREATE TABLE IF NOT EXISTS "integration_provider_logos" (
    "providerId" TEXT NOT NULL,
    "logoKey" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_provider_logos_pkey" PRIMARY KEY ("providerId")
);

DO $$ BEGIN
  ALTER TABLE "integration_provider_logos" ADD CONSTRAINT "integration_provider_logos_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
