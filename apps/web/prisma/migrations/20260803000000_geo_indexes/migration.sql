-- O mapa público consulta por retângulo e NÃO exige autenticação. Sem estes
-- índices cada arrasto vira varredura sequencial das duas tabelas — barato de
-- abusar, e degrada em silêncio conforme os inquilinos crescem. Não existe
-- rate limiting no projeto: o teto de resultados e estes índices são a defesa.
CREATE INDEX "stores_latitude_longitude_idx" ON "stores"("latitude", "longitude");
CREATE INDEX "directory_stores_latitude_longitude_idx" ON "directory_stores"("latitude", "longitude");
