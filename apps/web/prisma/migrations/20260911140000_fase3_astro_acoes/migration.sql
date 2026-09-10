-- Auditoria do que o Astro executou a pedido de alguém, depois da aprovação
-- na conversa: o argumento, o resultado, o erro e quantas ★ custou.
CREATE TABLE IF NOT EXISTS "astro_acoes" (
  "id"              TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id"         TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "session_id"      TEXT,
  "tool"            TEXT NOT NULL,
  "entrada"         JSONB NOT NULL,
  "resultado"       JSONB,
  "erro"            TEXT,
  "stars_cobradas"  INTEGER NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "astro_acoes_organization_id_created_at_idx" ON "astro_acoes"("organization_id", "created_at");
