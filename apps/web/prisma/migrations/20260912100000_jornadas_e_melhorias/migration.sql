-- Jornadas guiadas do Astro (Fase 0) e as sugestões de melhoria do painel.
--
-- Escrita à mão e idempotente, como as migrations de setembro: o schema do
-- ambiente compartilhado está à frente do ledger, e `migrate dev` quer dropar
-- tabela que não é nossa.

-- O valor novo do enum vem sozinho, sem nenhuma linha desta migration usando
-- ele: no Postgres, um valor acrescentado não pode ser usado na MESMA
-- transação que o criou.
ALTER TYPE "star_transaction_type" ADD VALUE IF NOT EXISTS 'JORNADA_REWARD';

CREATE TABLE IF NOT EXISTS "jornada_progressos" (
  "id"               TEXT PRIMARY KEY,
  "organization_id"  TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id"          TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "jornada_id"       TEXT NOT NULL,
  "passo_atual"      INTEGER NOT NULL DEFAULT 0,
  "iniciada_em"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concluida_em"     TIMESTAMP(3),
  "apressos"         INTEGER NOT NULL DEFAULT 0,
  "stars_creditadas" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "jornada_progressos_organization_id_user_id_jornada_id_key"
  ON "jornada_progressos"("organization_id", "user_id", "jornada_id");

CREATE INDEX IF NOT EXISTS "jornada_progressos_organization_id_jornada_id_concluida_em_idx"
  ON "jornada_progressos"("organization_id", "jornada_id", "concluida_em");

CREATE INDEX IF NOT EXISTS "jornada_progressos_jornada_id_concluida_em_idx"
  ON "jornada_progressos"("jornada_id", "concluida_em");

-- A trava do "uma recompensa por empresa por jornada". Parcial, então não cabe
-- no schema.prisma — e é ela, não a leitura anterior, que resolve dois colegas
-- concluindo ao mesmo tempo: quem perde a corrida recebe P2002 e grava zero.
CREATE UNIQUE INDEX IF NOT EXISTS "jornada_progressos_recompensa_unica_por_org"
  ON "jornada_progressos"("organization_id", "jornada_id")
  WHERE "stars_creditadas" > 0;

DO $$ BEGIN
  CREATE TYPE "site_melhoria_status" AS ENUM ('NOVA', 'EM_ANALISE', 'FEITA', 'DESCARTADA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "site_melhorias" (
  "id"               TEXT PRIMARY KEY,
  "organizationId"   TEXT,
  "organizationName" TEXT,
  "userId"           TEXT,
  "userName"         TEXT,
  "userEmail"        TEXT,
  "pathname"         TEXT NOT NULL,
  "mensagem"         TEXT NOT NULL,
  "imagens"          TEXT[] NOT NULL DEFAULT '{}',
  "status"           "site_melhoria_status" NOT NULL DEFAULT 'NOVA',
  "resposta"         TEXT,
  "respondidaEm"     TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "site_melhorias_status_createdAt_idx"
  ON "site_melhorias"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "site_melhorias_organizationId_createdAt_idx"
  ON "site_melhorias"("organizationId", "createdAt");
