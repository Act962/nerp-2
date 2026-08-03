-- UF em duas letras, sempre.
--
-- As fontes discordam: o OpenStreetMap devolve "Piauí" por extenso e a planilha
-- de clientes traz "PI". Sem isto o mesmo estado conta duas vezes, e a faixa de
-- tamanho de mercado mostra "PI 1958 · Piauí 29" — que parece defeito porque é.
UPDATE "directory_stores" SET "state" = 'AC' WHERE lower("state") = lower('Acre');
UPDATE "stores" SET "state" = 'AC' WHERE lower("state") = lower('Acre');
UPDATE "directory_stores" SET "state" = 'AL' WHERE lower("state") = lower('Alagoas');
UPDATE "stores" SET "state" = 'AL' WHERE lower("state") = lower('Alagoas');
UPDATE "directory_stores" SET "state" = 'AP' WHERE lower("state") = lower('Amapá');
UPDATE "stores" SET "state" = 'AP' WHERE lower("state") = lower('Amapá');
UPDATE "directory_stores" SET "state" = 'AM' WHERE lower("state") = lower('Amazonas');
UPDATE "stores" SET "state" = 'AM' WHERE lower("state") = lower('Amazonas');
UPDATE "directory_stores" SET "state" = 'BA' WHERE lower("state") = lower('Bahia');
UPDATE "stores" SET "state" = 'BA' WHERE lower("state") = lower('Bahia');
UPDATE "directory_stores" SET "state" = 'CE' WHERE lower("state") = lower('Ceará');
UPDATE "stores" SET "state" = 'CE' WHERE lower("state") = lower('Ceará');
UPDATE "directory_stores" SET "state" = 'DF' WHERE lower("state") = lower('Distrito Federal');
UPDATE "stores" SET "state" = 'DF' WHERE lower("state") = lower('Distrito Federal');
UPDATE "directory_stores" SET "state" = 'ES' WHERE lower("state") = lower('Espírito Santo');
UPDATE "stores" SET "state" = 'ES' WHERE lower("state") = lower('Espírito Santo');
UPDATE "directory_stores" SET "state" = 'GO' WHERE lower("state") = lower('Goiás');
UPDATE "stores" SET "state" = 'GO' WHERE lower("state") = lower('Goiás');
UPDATE "directory_stores" SET "state" = 'MA' WHERE lower("state") = lower('Maranhão');
UPDATE "stores" SET "state" = 'MA' WHERE lower("state") = lower('Maranhão');
UPDATE "directory_stores" SET "state" = 'MT' WHERE lower("state") = lower('Mato Grosso');
UPDATE "stores" SET "state" = 'MT' WHERE lower("state") = lower('Mato Grosso');
UPDATE "directory_stores" SET "state" = 'MS' WHERE lower("state") = lower('Mato Grosso do Sul');
UPDATE "stores" SET "state" = 'MS' WHERE lower("state") = lower('Mato Grosso do Sul');
UPDATE "directory_stores" SET "state" = 'MG' WHERE lower("state") = lower('Minas Gerais');
UPDATE "stores" SET "state" = 'MG' WHERE lower("state") = lower('Minas Gerais');
UPDATE "directory_stores" SET "state" = 'PA' WHERE lower("state") = lower('Pará');
UPDATE "stores" SET "state" = 'PA' WHERE lower("state") = lower('Pará');
UPDATE "directory_stores" SET "state" = 'PB' WHERE lower("state") = lower('Paraíba');
UPDATE "stores" SET "state" = 'PB' WHERE lower("state") = lower('Paraíba');
UPDATE "directory_stores" SET "state" = 'PR' WHERE lower("state") = lower('Paraná');
UPDATE "stores" SET "state" = 'PR' WHERE lower("state") = lower('Paraná');
UPDATE "directory_stores" SET "state" = 'PE' WHERE lower("state") = lower('Pernambuco');
UPDATE "stores" SET "state" = 'PE' WHERE lower("state") = lower('Pernambuco');
UPDATE "directory_stores" SET "state" = 'PI' WHERE lower("state") = lower('Piauí');
UPDATE "stores" SET "state" = 'PI' WHERE lower("state") = lower('Piauí');
UPDATE "directory_stores" SET "state" = 'RJ' WHERE lower("state") = lower('Rio de Janeiro');
UPDATE "stores" SET "state" = 'RJ' WHERE lower("state") = lower('Rio de Janeiro');
UPDATE "directory_stores" SET "state" = 'RN' WHERE lower("state") = lower('Rio Grande do Norte');
UPDATE "stores" SET "state" = 'RN' WHERE lower("state") = lower('Rio Grande do Norte');
UPDATE "directory_stores" SET "state" = 'RS' WHERE lower("state") = lower('Rio Grande do Sul');
UPDATE "stores" SET "state" = 'RS' WHERE lower("state") = lower('Rio Grande do Sul');
UPDATE "directory_stores" SET "state" = 'RO' WHERE lower("state") = lower('Rondônia');
UPDATE "stores" SET "state" = 'RO' WHERE lower("state") = lower('Rondônia');
UPDATE "directory_stores" SET "state" = 'RR' WHERE lower("state") = lower('Roraima');
UPDATE "stores" SET "state" = 'RR' WHERE lower("state") = lower('Roraima');
UPDATE "directory_stores" SET "state" = 'SC' WHERE lower("state") = lower('Santa Catarina');
UPDATE "stores" SET "state" = 'SC' WHERE lower("state") = lower('Santa Catarina');
UPDATE "directory_stores" SET "state" = 'SP' WHERE lower("state") = lower('São Paulo');
UPDATE "stores" SET "state" = 'SP' WHERE lower("state") = lower('São Paulo');
UPDATE "directory_stores" SET "state" = 'SE' WHERE lower("state") = lower('Sergipe');
UPDATE "stores" SET "state" = 'SE' WHERE lower("state") = lower('Sergipe');
UPDATE "directory_stores" SET "state" = 'TO' WHERE lower("state") = lower('Tocantins');
UPDATE "stores" SET "state" = 'TO' WHERE lower("state") = lower('Tocantins');
