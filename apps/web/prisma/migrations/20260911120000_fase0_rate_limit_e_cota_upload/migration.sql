-- Fase 0 do sandbox: limite de requisições do Better Auth no banco e cota
-- diária de upload por organização. `IF NOT EXISTS` porque as migrations
-- desta base são aplicadas à mão e precisam ser reexecutáveis.
CREATE TABLE IF NOT EXISTS "rateLimit" (
  "id"          TEXT PRIMARY KEY,
  "key"         TEXT NOT NULL,
  "count"       INTEGER NOT NULL,
  "lastRequest" DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS "rateLimit_key_idx" ON "rateLimit"("key");

CREATE TABLE IF NOT EXISTS "upload_quota_daily" (
  "id"              TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "day"             TEXT NOT NULL,
  "bytes"           INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "upload_quota_daily_organization_id_day_key" ON "upload_quota_daily"("organization_id", "day");
