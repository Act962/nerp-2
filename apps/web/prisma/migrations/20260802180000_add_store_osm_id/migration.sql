-- Identidade do ponto no OpenStreetMap ("node/123").
-- O índice único por organização é o que torna a importação idempotente:
-- varrer a mesma área duas vezes não cria cliente repetido. NULL não conflita
-- com NULL no Postgres, então cliente cadastrado à mão continua livre.
ALTER TABLE "stores" ADD COLUMN "osmId" TEXT;

CREATE UNIQUE INDEX "stores_organizationId_osmId_key" ON "stores"("organizationId", "osmId");

ALTER TYPE "StoreGeoSource" ADD VALUE 'OSM';
