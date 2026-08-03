-- Logo por ponto, sobrepondo a da rede. `companyId` é anulável, então um ponto
-- sem rede não teria onde guardar logo.
ALTER TABLE "directory_stores" ADD COLUMN "logoKey" TEXT;

-- A resolução da "face pública" faz WHERE "osmId" IN (...) com centenas de ids.
-- O único índice com osmId hoje é (organizationId, osmId), onde osmId é a
-- SEGUNDA coluna — inútil para essa busca. Sem este índice a consulta varre
-- `stores` inteira a cada carregamento do mapa, e só fica pior com o tempo.
CREATE INDEX "stores_osmId_idx" ON "stores"("osmId");
