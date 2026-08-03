-- CEP, só dígitos.
--
-- Além de completar o endereço, é o caminho barato para virar coordenada: as
-- bases brasileiras de CEP (ViaCEP, BrasilAPI) não têm o limite de 1 requisição
-- por segundo do Nominatim, e resolvem no nível da rua. Não é a porta da loja —
-- isso só a foto do promotor dá —, mas põe o pino no quarteirão certo.
ALTER TABLE "directory_stores" ADD COLUMN "postcode" TEXT;
ALTER TABLE "stores" ADD COLUMN "postcode" TEXT;
