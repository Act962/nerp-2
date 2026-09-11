-- Avisos proativos do Astro. `dedupe_key` é o que impede o mesmo aviso de
-- nascer de novo a cada passada do cron no mesmo dia.
CREATE TABLE IF NOT EXISTS "astro_avisos" (
  "id"              TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "tipo"            TEXT NOT NULL,
  "severidade"      TEXT NOT NULL,
  "titulo"          TEXT NOT NULL,
  "corpo"           TEXT NOT NULL,
  "dados"           JSONB,
  "dedupe_key"      TEXT NOT NULL,
  "lido_em"         TIMESTAMP(3),
  "falado_em"       TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "astro_avisos_organization_id_dedupe_key_key"
  ON "astro_avisos"("organization_id", "dedupe_key");
CREATE INDEX IF NOT EXISTS "astro_avisos_organization_id_lido_em_created_at_idx"
  ON "astro_avisos"("organization_id", "lido_em", "created_at");

-- O que o Astro lembra de cada organização. A unicidade por chave é o que
-- faz "lembrar" de novo atualizar o fato em vez de acumular duplicata.
CREATE TABLE IF NOT EXISTS "astro_memorias" (
  "id"              TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "chave"           TEXT NOT NULL,
  "texto"           TEXT NOT NULL,
  "origem"          TEXT NOT NULL DEFAULT 'pessoa',
  "criado_por_id"   TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "astro_memorias_organization_id_chave_key"
  ON "astro_memorias"("organization_id", "chave");
CREATE INDEX IF NOT EXISTS "astro_memorias_organization_id_updated_at_idx"
  ON "astro_memorias"("organization_id", "updated_at");
