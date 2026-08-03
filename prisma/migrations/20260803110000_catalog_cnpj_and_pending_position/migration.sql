-- CNPJ do ESTABELECIMENTO como identidade do ponto de venda.
--
-- No Brasil matriz e filial têm CNPJs diferentes, então ele identifica a loja
-- física — melhor que nome+distância, que é palpite, e melhor que `osmId`, que
-- só existe para o que o OpenStreetMap mapeou. Com ele, duas listas de
-- distribuidores diferentes fundem no mesmo ponto sem geocodificar nada.
--
-- Só dígitos, sem máscara. NULL não colide com NULL no Postgres, então ponto
-- sem CNPJ conhecido não custa nada.
ALTER TABLE "directory_stores" ADD COLUMN "document" TEXT;
CREATE UNIQUE INDEX "directory_stores_document_key" ON "directory_stores"("document");

-- Coordenada passa a ser OPCIONAL.
--
-- A lista de PDVs entra com endereço e sem coordenada; quem fixa o pino é a
-- primeira foto do promotor, que está na porta da loja. Isso troca horas de
-- geocodificação em massa — que a política do Nominatim desencoraja e cujo
-- bloqueio derrubaria o endereço das fotos em produção — por trabalho de campo
-- que já acontece de qualquer forma.
--
-- Consequência a respeitar em TODA leitura: ponto sem coordenada não vai ao
-- mapa. Ele existe, é buscável e é contável, mas não tem pino.
ALTER TABLE "directory_stores" ALTER COLUMN "latitude" DROP NOT NULL;
ALTER TABLE "directory_stores" ALTER COLUMN "longitude" DROP NOT NULL;
