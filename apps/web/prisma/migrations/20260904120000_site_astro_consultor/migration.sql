-- Astro consultor: a conversa do site e o lead que sai dela.
--
-- Globais, sem organizationId, como as demais site_*: o site é um só e o lead
-- é da ÓRBITA. O organizationId de `site_chat_sessions` é do canal logado —
-- diz de quem é a conversa, não isola dado entre inquilinos.
--
-- Idempotente, no padrão das migrações site_* anteriores.

DO $$ BEGIN
  CREATE TYPE "site_lead_status" AS ENUM ('NOVO', 'EM_CONTATO', 'QUALIFICADO', 'GANHO', 'PERDIDO', 'ARQUIVADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "site_chat_channel" AS ENUM ('SITE', 'APP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "site_leads" (
  "id"             TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "company"        TEXT,
  "email"          TEXT,
  "phone"          TEXT,
  "segment"        TEXT,
  "stores"         INTEGER,
  "users"          INTEGER,
  "toolIds"        TEXT[] DEFAULT ARRAY[]::TEXT[],
  "quotedMinCents" INTEGER,
  "quotedMaxCents" INTEGER,
  "briefing"       JSONB,
  "status"         "site_lead_status" NOT NULL DEFAULT 'NOVO',
  "notes"          TEXT,
  "handoffAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "site_chat_sessions" (
  "id"             TEXT NOT NULL,
  "channel"        "site_chat_channel" NOT NULL DEFAULT 'SITE',
  "organizationId" TEXT,
  "userId"         TEXT,
  "ipHash"         TEXT,
  "userAgent"      TEXT,
  "landingPage"    TEXT,
  "utmSource"      TEXT,
  "utmMedium"      TEXT,
  "utmCampaign"    TEXT,
  "messageCount"   INTEGER NOT NULL DEFAULT 0,
  "tokensIn"       INTEGER NOT NULL DEFAULT 0,
  "tokensOut"      INTEGER NOT NULL DEFAULT 0,
  "diagnostic"     JSONB,
  "summary"        TEXT,
  "leadId"         TEXT,
  "consentAt"      TIMESTAMP(3),
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_chat_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "site_leads_status_createdAt_idx" ON "site_leads" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "site_leads_email_idx" ON "site_leads" ("email");

CREATE INDEX IF NOT EXISTS "site_chat_sessions_expiresAt_idx" ON "site_chat_sessions" ("expiresAt");
-- O limite por IP conta sessões de uma janela: sem este índice, cada mensagem
-- do chat faria varredura na tabela inteira.
CREATE INDEX IF NOT EXISTS "site_chat_sessions_ipHash_createdAt_idx" ON "site_chat_sessions" ("ipHash", "createdAt");
CREATE INDEX IF NOT EXISTS "site_chat_sessions_leadId_idx" ON "site_chat_sessions" ("leadId");

DO $$ BEGIN
  ALTER TABLE "site_chat_sessions"
    ADD CONSTRAINT "site_chat_sessions_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "site_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
