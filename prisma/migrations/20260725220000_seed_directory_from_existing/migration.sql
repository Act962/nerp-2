-- Backfill do Diretório de Empresas a partir do que já estava cadastrado:
--   indústrias  = suppliers        → CompanyType INDUSTRIA
--   supermercados = organizations com lojas → CompanyType SUPERMERCADO
--   distribuidores = distributors  → CompanyType DISTRIBUIDOR
-- Cada empresa é reivindicada pela própria org (claimedByOrgId), então aparece
-- como "Sua empresa". Dedup por CNPJ via ON CONFLICT (document).
-- Idempotente: só roda uma vez (rastreado em _prisma_migrations).

-- Indústrias (suppliers)
INSERT INTO "directory_companies"
  ("id", "type", "name", "tradeName", "document", "city", "state", "source", "claimedByOrgId", "claimedAt", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'INDUSTRIA'::"CompanyType",
  s."name",
  s."tradeName",
  s."document",
  s."city",
  s."state",
  'SEED'::"CompanySource",
  s."organizationId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "suppliers" s
ON CONFLICT ("document") DO NOTHING;

-- Distribuidores (distributors)
INSERT INTO "directory_companies"
  ("id", "type", "name", "document", "source", "claimedByOrgId", "claimedAt", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'DISTRIBUIDOR'::"CompanyType",
  d."name",
  d."document",
  'SEED'::"CompanySource",
  d."organizationId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "distributors" d
ON CONFLICT ("document") DO NOTHING;

-- Supermercados (organizations que possuem lojas)
INSERT INTO "directory_companies"
  ("id", "type", "name", "tradeName", "document", "source", "claimedByOrgId", "claimedAt", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'SUPERMERCADO'::"CompanyType",
  o."name",
  o."tradeName",
  o."document",
  'SEED'::"CompanySource",
  o."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "organization" o
WHERE EXISTS (SELECT 1 FROM "stores" st WHERE st."organizationId" = o."id")
ON CONFLICT ("document") DO NOTHING;
