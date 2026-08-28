-- Celular como leitor de código de barras do PDV.
--
-- O QR na tela do PDV carrega o token; quem abre vira leitor daquele terminal,
-- sem digitar senha — é o que torna o recurso usável no balcão. Em troca, a
-- janela é curta e o uso é único.
--
-- Os códigos lidos são PERSISTIDOS em vez de trafegados só em memória: o PDV
-- pode estar recarregando no instante da leitura, e código perdido no balcão
-- significa item que não entrou na venda.
--
-- IF NOT EXISTS porque o `migrate deploy` desta base está bloqueado por uma
-- migração falha anterior (P3009) e esta é aplicada à mão.
DO $$ BEGIN
  CREATE TYPE "ScannerPairingStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "scanner_pairings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "ScannerPairingStatus" NOT NULL DEFAULT 'PENDING',
    "claimedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scanner_pairings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "scanner_scans" (
    "id" TEXT NOT NULL,
    "pairingId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scanner_scans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "scanner_pairings_token_key" ON "scanner_pairings"("token");
CREATE INDEX IF NOT EXISTS "scanner_pairings_organizationId_status_idx" ON "scanner_pairings"("organizationId", "status");
-- Cobre a leitura quente: pendências de um pareamento.
CREATE INDEX IF NOT EXISTS "scanner_scans_pairingId_consumedAt_idx" ON "scanner_scans"("pairingId", "consumedAt");

DO $$ BEGIN
  ALTER TABLE "scanner_pairings" ADD CONSTRAINT "scanner_pairings_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "scanner_pairings" ADD CONSTRAINT "scanner_pairings_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "scanner_scans" ADD CONSTRAINT "scanner_scans_pairingId_fkey"
    FOREIGN KEY ("pairingId") REFERENCES "scanner_pairings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
