-- Idempotente: este schema já existe em bancos que o receberam à mão, sem a
-- linha correspondente no _prisma_migrations. As guardas deixam o
-- `migrate deploy` registrar a migração sem tentar recriar o que já está lá.

-- CreateTable
CREATE TABLE IF NOT EXISTS "cash_registers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "cash_registers_organizationId_idx" ON "cash_registers"("organizationId");
DO $$ BEGIN
  ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nova coluna (nullable primeiro, p/ backfill)
ALTER TABLE "cash_sessions" ADD COLUMN IF NOT EXISTS "registerId" TEXT;

-- Backfill: cria um "Caixa 01" por org que já tem sessões e vincula as sessões.
-- Já se protege sozinho — num banco onde o backfill rodou, nenhuma sessão tem
-- "registerId" nulo, então o CTE não seleciona nada e nada é inserido.
WITH orgs AS (
  SELECT DISTINCT "organizationId" AS org FROM "cash_sessions" WHERE "registerId" IS NULL
), ins AS (
  INSERT INTO "cash_registers" ("id", "organizationId", "name", "isActive", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, org, 'Caixa 01', true, now(), now() FROM orgs
  RETURNING "id", "organizationId"
)
UPDATE "cash_sessions" cs SET "registerId" = ins."id"
FROM ins WHERE cs."organizationId" = ins."organizationId" AND cs."registerId" IS NULL;

-- Agora exige NOT NULL (no-op se a coluna já for NOT NULL)
ALTER TABLE "cash_sessions" ALTER COLUMN "registerId" SET NOT NULL;

-- FK + índice
DO $$ BEGIN
  ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "cash_sessions_registerId_idx" ON "cash_sessions"("registerId");

-- 1 sessão aberta por caixa (terminal)
CREATE UNIQUE INDEX IF NOT EXISTS "cash_sessions_open_per_register" ON "cash_sessions"("organizationId", "registerId") WHERE "status" = 'OPEN';
