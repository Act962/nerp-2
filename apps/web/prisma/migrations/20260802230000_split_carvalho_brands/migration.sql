-- "R Carvalho" e "Carvalho Super" são redes DIFERENTES, com logos diferentes.
-- A semeadura anterior jogou os 27 pontos numa bandeira só e aplicou a logo do
-- R Carvalho em todos — errado. Aqui cada nome de bandeira vira uma empresa
-- própria, para cada uma poder ter a sua logo.
--
-- Só o R Carvalho fica com logo: é a única que temos. As outras entram sem
-- nenhuma, porque pino com a marca errada é pior que pino sem marca.

UPDATE "directory_companies"
   SET name = 'R Carvalho', "tradeName" = 'R Carvalho'
 WHERE id = 'dircomp_r_carvalho';

INSERT INTO "directory_companies"
  (id, type, name, "tradeName", city, state, "logoKey", source, "createdAt", "updatedAt")
VALUES
  ('dircomp_carvalho_super',     'SUPERMERCADO', 'Carvalho Super',     'Carvalho Super',     'Teresina', 'Piauí', NULL, 'SEED', now(), now()),
  ('dircomp_comercial_carvalho', 'SUPERMERCADO', 'Comercial Carvalho', 'Comercial Carvalho', 'Teresina', 'Piauí', NULL, 'SEED', now(), now()),
  ('dircomp_carvalho_mercadao',  'SUPERMERCADO', 'Carvalho Mercadão',  'Carvalho Mercadão',  'Teresina', 'Piauí', NULL, 'SEED', now(), now()),
  ('dircomp_armazem_carvalho',   'SUPERMERCADO', 'Armazém Carvalho',   'Armazém Carvalho',   'Teresina', 'Piauí', NULL, 'SEED', now(), now()),
  ('dircomp_carvalho',           'SUPERMERCADO', 'Carvalho',           'Carvalho',           'Teresina', 'Piauí', NULL, 'SEED', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Condições explícitas em vez de LIKE: 'Carvalho Super%' pegaria também
-- 'Carvalho Supermercado', que é outro nome e pode ser outra bandeira.
UPDATE "directory_stores" SET "companyId" = 'dircomp_carvalho_super'
 WHERE name IN ('Carvalho Super', 'Carvalho Super - Frei Serafim');

UPDATE "directory_stores" SET "companyId" = 'dircomp_comercial_carvalho'
 WHERE name = 'Comercial Carvalho';

UPDATE "directory_stores" SET "companyId" = 'dircomp_carvalho_mercadao'
 WHERE name = 'Carvalho Mercadão';

UPDATE "directory_stores" SET "companyId" = 'dircomp_armazem_carvalho'
 WHERE name = 'Armazem Carvalho';

-- 'Carvalho' e 'Carvalho Supermercado' são ambíguos no OpenStreetMap: não dá
-- para saber de qual rede são. Ficam numa bandeira genérica, sem logo, até
-- alguém que conheça a praça dizer.
UPDATE "directory_stores" SET "companyId" = 'dircomp_carvalho'
 WHERE name IN ('Carvalho', 'Carvalho Supermercado');

-- Sobram no R Carvalho apenas os que levam o nome dele.
UPDATE "directory_stores" SET "companyId" = 'dircomp_r_carvalho'
 WHERE name LIKE 'R Carvalho%' OR name LIKE 'R. Carvalho%';

-- Nenhum override por ponto deve sobreviver à correção: ele venceria a logo da
-- bandeira certa sem ninguém entender por quê.
UPDATE "directory_stores" SET "logoKey" = NULL WHERE "logoKey" IS NOT NULL;
