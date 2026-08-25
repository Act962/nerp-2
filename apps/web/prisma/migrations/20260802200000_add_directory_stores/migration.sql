-- Pontos de venda conhecidos, globais. Sem organizationId de propósito: o varejo
-- da praça existe independente de quem o tem como cliente.
CREATE TABLE "directory_stores" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "osmId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "suburb" TEXT,
    "city" TEXT,
    "state" TEXT,
    "source" "CompanySource" NOT NULL DEFAULT 'SEED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "directory_stores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "directory_stores_osmId_key" ON "directory_stores"("osmId");
CREATE INDEX "directory_stores_companyId_idx" ON "directory_stores"("companyId");
CREATE INDEX "directory_stores_state_city_idx" ON "directory_stores"("state", "city");

ALTER TABLE "directory_stores" ADD CONSTRAINT "directory_stores_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "directory_companies"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
