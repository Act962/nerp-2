-- Idempotente: este schema já existe em bancos que o receberam à mão, sem a
-- linha correspondente no _prisma_migrations. As guardas deixam o
-- `migrate deploy` registrar a migração sem tentar recriar o que já está lá.

-- CreateTable
CREATE TABLE IF NOT EXISTS "devices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "devices_tokenHash_key" ON "devices"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "devices_organizationId_idx" ON "devices"("organizationId");
