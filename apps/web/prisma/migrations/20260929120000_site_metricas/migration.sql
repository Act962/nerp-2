-- As métricas do site institucional: visitas, páginas vistas e cliques, e a
-- ponte entre a conversa do Astro e a visita em que ela aconteceu.
--
-- Globais, sem `organization_id`, como todas as `site_*`: o site é um só.
-- Aditiva: nada é removido, então uma base já migrada não perde dado.
CREATE TABLE IF NOT EXISTS "site_visits" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "landingPath" TEXT NOT NULL,
    "referrerHost" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "device" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "site_visits_startedAt_idx" ON "site_visits"("startedAt");
CREATE INDEX IF NOT EXISTS "site_visits_visitorId_idx" ON "site_visits"("visitorId");

CREATE TABLE IF NOT EXISTS "site_page_views" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "maxScroll" INTEGER NOT NULL DEFAULT 0,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_page_views_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "site_page_views_visitId_enteredAt_idx" ON "site_page_views"("visitId", "enteredAt");
CREATE INDEX IF NOT EXISTS "site_page_views_enteredAt_idx" ON "site_page_views"("enteredAt");

CREATE TABLE IF NOT EXISTS "site_visit_events" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "target" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_visit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "site_visit_events_createdAt_idx" ON "site_visit_events"("createdAt");
CREATE INDEX IF NOT EXISTS "site_visit_events_visitId_idx" ON "site_visit_events"("visitId");

ALTER TABLE "site_chat_sessions" ADD COLUMN IF NOT EXISTS "visitId" TEXT;
CREATE INDEX IF NOT EXISTS "site_chat_sessions_visitId_idx" ON "site_chat_sessions"("visitId");

DO $$ BEGIN
  ALTER TABLE "site_page_views" ADD CONSTRAINT "site_page_views_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "site_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "site_visit_events" ADD CONSTRAINT "site_visit_events_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "site_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "site_chat_sessions" ADD CONSTRAINT "site_chat_sessions_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "site_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
