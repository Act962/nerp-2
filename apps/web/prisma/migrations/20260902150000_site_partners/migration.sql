-- Parceiros e marcas do site institucional.
--
-- Duas tabelas, e não uma com um campo de tipo, porque são duas coisas:
-- parceiro é um case (tem foto e história) e marca é um logotipo num quadro.
-- Uma tabela só deixaria metade das colunas nulas em metade das linhas.
--
-- Globais, sem organizationId, como as demais site_*: o site é um só.
-- Idempotente, no padrão das migrações site_* anteriores.

CREATE TABLE IF NOT EXISTS "site_partners" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "photo"     TEXT,
  "logo"      TEXT,
  "story"     TEXT NOT NULL,
  "href"      TEXT,
  "position"  INTEGER NOT NULL DEFAULT 0,
  "visible"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_partners_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "site_brands" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "logo"      TEXT NOT NULL,
  "href"      TEXT,
  "position"  INTEGER NOT NULL DEFAULT 0,
  "visible"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_brands_pkey" PRIMARY KEY ("id")
);

-- O site lê sempre a mesma coisa: os visíveis, na ordem.
CREATE INDEX IF NOT EXISTS "site_partners_visible_position_idx"
  ON "site_partners" ("visible", "position");

CREATE INDEX IF NOT EXISTS "site_brands_visible_position_idx"
  ON "site_brands" ("visible", "position");
