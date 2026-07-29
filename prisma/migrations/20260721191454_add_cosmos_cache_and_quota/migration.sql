-- Cache e cota da API Cosmos. Aditivo puro: tres tabelas novas, vazias.

CREATE TABLE "cosmos_query_cache" (
    "queryNorm" TEXT NOT NULL,
    "gtins" TEXT[],
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cosmos_query_cache_pkey" PRIMARY KEY ("queryNorm")
);

CREATE TABLE "cosmos_usage" (
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "cooldownUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cosmos_usage_pkey" PRIMARY KEY ("day")
);

CREATE TABLE "cosmos_org_usage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hour" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "cosmos_org_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cosmos_org_usage_organizationId_hour_key" ON "cosmos_org_usage"("organizationId", "hour");
