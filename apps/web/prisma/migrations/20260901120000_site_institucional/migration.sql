-- Site institucional da ÓRBITA HUB: menu, páginas internas, mídia, acessos.
--
-- Tabelas GLOBAIS de propósito (sem organizationId). O site é um só; quem
-- escreve é um administrador do site, não um member de organização. Ver o
-- comentário do bloco em `schema.prisma`.
--
-- IF NOT EXISTS / DO $$ porque o `migrate deploy` desta base já foi aplicado à
-- mão antes (P3009) e esta migração precisa ser reaplicável sem quebrar.

DO $$ BEGIN
  CREATE TYPE "SiteAdminRole" AS ENUM ('SUPER_ADMIN', 'EDITOR', 'REDATOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SiteMenuPanel" AS ENUM ('SOLUCOES', 'SEGMENTOS', 'SOBRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SitePageStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "site_admins" (
  "id"        TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "name"      TEXT,
  "role"      "SiteAdminRole" NOT NULL DEFAULT 'EDITOR',
  "userId"    TEXT,
  "invitedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_admins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "site_admins_email_key" ON "site_admins"("email");

CREATE TABLE IF NOT EXISTS "site_pages" (
  "id"              TEXT NOT NULL,
  "slug"            TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "status"          "SitePageStatus" NOT NULL DEFAULT 'DRAFT',
  "blocks"          JSONB NOT NULL DEFAULT '[]',
  "publishedBlocks" JSONB,
  "seoTitle"        TEXT,
  "seoDescription"  TEXT,
  "ogImage"         TEXT,
  "publishedAt"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_pages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "site_pages_slug_key" ON "site_pages"("slug");
CREATE INDEX IF NOT EXISTS "site_pages_status_idx" ON "site_pages"("status");

CREATE TABLE IF NOT EXISTS "site_menu_items" (
  "id"         TEXT NOT NULL,
  "panel"      "SiteMenuPanel" NOT NULL,
  "groupTitle" TEXT NOT NULL,
  "slug"       TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "summary"    TEXT NOT NULL DEFAULT '',
  "iconKey"    TEXT,
  "iconImage"  TEXT,
  "color"      TEXT,
  "href"       TEXT,
  "pageId"     TEXT,
  "position"   INTEGER NOT NULL DEFAULT 0,
  "visible"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_menu_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "site_menu_items_panel_slug_key" ON "site_menu_items"("panel", "slug");
CREATE INDEX IF NOT EXISTS "site_menu_items_panel_position_idx" ON "site_menu_items"("panel", "position");

DO $$ BEGIN
  ALTER TABLE "site_menu_items"
    ADD CONSTRAINT "site_menu_items_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "site_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "site_media" (
  "id"          TEXT NOT NULL,
  "key"         TEXT NOT NULL,
  "fileName"    TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "size"        INTEGER NOT NULL,
  "width"       INTEGER,
  "height"      INTEGER,
  "alt"         TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_media_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "site_media_key_key" ON "site_media"("key");
CREATE INDEX IF NOT EXISTS "site_media_createdAt_idx" ON "site_media"("createdAt");

CREATE TABLE IF NOT EXISTS "site_settings" (
  "key"       TEXT NOT NULL,
  "value"     JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);
