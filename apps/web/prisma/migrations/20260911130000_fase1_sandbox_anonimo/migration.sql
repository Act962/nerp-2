-- Fase 1 do sandbox: conta anônima (plugin `anonymous` do Better Auth),
-- organização verificada/sandbox, nicho e interesses do onboarding, e a marca
-- de dado de exemplo nos modelos que o pacote por solução semeia.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isAnonymous" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "linked_to_user_id" TEXT;
CREATE INDEX IF NOT EXISTS "user_isAnonymous_createdAt_idx" ON "user"("isAnonymous", "createdAt");

ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3);
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "last_access_at" TIMESTAMP(3);
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "expiry_warned_at" TIMESTAMP(3);
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "niche" TEXT;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "interests" TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS "organization_verified_at_last_access_at_idx" ON "organization"("verified_at", "last_access_at");

-- Toda organização que já existia é verificada: o sandbox só vale para quem
-- entrar pelo "Começar agora" daqui em diante.
UPDATE "organization" SET "verified_at" = "createdAt" WHERE "verified_at" IS NULL;
UPDATE "organization" SET "last_access_at" = "updatedAt" WHERE "last_access_at" IS NULL;

ALTER TABLE "crm_funnels"        ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "crm_tags"           ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "crm_leads"          ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "calendar_events"    ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sales"              ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sales_goal_periods" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "receipt_templates"  ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
