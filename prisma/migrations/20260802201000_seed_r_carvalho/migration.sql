-- Rede R Carvalho semeada no diretório GLOBAL do TradeGram.
--
-- Vai numa migração, não num seed avulso: `pnpm build` roda `prisma migrate
-- deploy`, então qualquer ambiente que suba a aplicação já nasce com o varejo
-- no mapa. Um seed manual dependeria de alguém lembrar de rodá-lo.
--
-- Idempotente pelo `osmId`: reaplicar não duplica, e a migração pode conviver
-- com pontos que já tenham entrado por outro caminho.
INSERT INTO "directory_companies" (id, type, name, "tradeName", city, state, "logoKey", source, "createdAt", "updatedAt")
VALUES ('dircomp_r_carvalho', 'SUPERMERCADO', 'R Carvalho Supermercados', 'R Carvalho', 'Teresina', 'Piauí', '/marcas/r-carvalho.jpeg', 'SEED', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "directory_stores"
  (id, "companyId", name, "osmId", latitude, longitude, address, city, state, "updatedAt")
VALUES
  ('dirstore_node_6491614816', 'dircomp_r_carvalho', 'Armazem Carvalho', 'node/6491614816', -5.0961121, -42.8164113, 'Avenida Maranhão', 'Teresina', 'Piauí', now()),
  ('dirstore_way_635634185', 'dircomp_r_carvalho', 'Carvalho', 'way/635634185', -5.0803062, -42.8157343, 'Rua Gabriel Ferreira', 'Teresina', 'Piauí', now()),
  ('dirstore_node_5305124125', 'dircomp_r_carvalho', 'Carvalho', 'node/5305124125', -5.0486898, -42.8151452, 'Avenida União', 'Teresina', 'Piauí', now()),
  ('dirstore_node_6818184116', 'dircomp_r_carvalho', 'Carvalho', 'node/6818184116', -5.068528, -42.816993, 'Avenida Petronio Portela', 'Teresina', 'Piauí', now()),
  ('dirstore_way_589720463', 'dircomp_r_carvalho', 'Carvalho Mercadão', 'way/589720463', -5.0566403, -42.7492711, 'Avenida Zequinha Freire', 'Teresina', 'Piauí', now()),
  ('dirstore_way_377639948', 'dircomp_r_carvalho', 'Carvalho Mercadão', 'way/377639948', -5.1106608, -42.7721536, 'Avenida Deputado Paulo Ferraz', 'Teresina', 'Piauí', now()),
  ('dirstore_way_779150445', 'dircomp_r_carvalho', 'Carvalho Super', 'way/779150445', -5.1442083, -42.7798838, 'Rua Luiz Eduardo Ferreira', 'Teresina', 'Piauí', now()),
  ('dirstore_node_3283078107', 'dircomp_r_carvalho', 'Carvalho Super', 'node/3283078107', -5.1030053, -42.790566, 'Avenida Barão de Castelo Branco, 2135', 'Teresina', 'Piauí', now()),
  ('dirstore_node_7507265763', 'dircomp_r_carvalho', 'Carvalho Super', 'node/7507265763', -5.1052782, -42.8075929, 'Avenida Nações Unidas', 'Teresina', 'Piauí', now()),
  ('dirstore_node_9768104376', 'dircomp_r_carvalho', 'Carvalho Super', 'node/9768104376', -5.0778211, -42.7953476, 'Avenida Ininga, 1201', 'Teresina', 'Piauí', now()),
  ('dirstore_way_413063051', 'dircomp_r_carvalho', 'Carvalho Super', 'way/413063051', -5.085726, -42.7346876, 'Avenida Mirtes Melão', 'Teresina', 'Piauí', now()),
  ('dirstore_way_413065670', 'dircomp_r_carvalho', 'Carvalho Super', 'way/413065670', -5.1020227, -42.752453, 'Avenida Joaquim Nelson, 3167', 'Teresina', 'Piauí', now()),
  ('dirstore_way_622099434', 'dircomp_r_carvalho', 'Carvalho Super', 'way/622099434', -5.0812428, -42.7806452, 'Rua Pedro Conde', 'Teresina', 'Piauí', now()),
  ('dirstore_way_742876530', 'dircomp_r_carvalho', 'Carvalho Super', 'way/742876530', -5.0775134, -42.7730705, 'Rua Margarida', 'Teresina', 'Piauí', now()),
  ('dirstore_way_887359073', 'dircomp_r_carvalho', 'Carvalho Super', 'way/887359073', -5.0655373, -42.8297316, 'Rua Rui Barbosa', 'Teresina', 'Piauí', now()),
  ('dirstore_way_987007959', 'dircomp_r_carvalho', 'Carvalho Super', 'way/987007959', -5.0735112, -42.7488503, 'Avenida Zequinha Freire', 'Teresina', 'Piauí', now()),
  ('dirstore_way_204250001', 'dircomp_r_carvalho', 'Carvalho Super - Frei Serafim', 'way/204250001', -5.0863728, -42.8014232, 'Avenida Frei Serafim', 'Teresina', 'Piauí', now()),
  ('dirstore_node_2401424789', 'dircomp_r_carvalho', 'Carvalho Supermercado', 'node/2401424789', -5.0684886, -42.7839053, 'Avenida Homero Castelo Branco', 'Teresina', 'Piauí', now()),
  ('dirstore_way_413356646', 'dircomp_r_carvalho', 'Comercial Carvalho', 'way/413356646', -5.1203613, -42.8035546, 'Avenida Barão de Gurguéia', 'Teresina', 'Piauí', now()),
  ('dirstore_way_579845976', 'dircomp_r_carvalho', 'Comercial Carvalho', 'way/579845976', -5.0776019, -42.8120895, 'Rua Coelho de Resende', 'Teresina', 'Piauí', now()),
  ('dirstore_way_204657661', 'dircomp_r_carvalho', 'Comercial Carvalho', 'way/204657661', -5.0345526, -42.8142065, 'Avenida Prefeito Freitas Neto', 'Bairro Bom Jesus', 'Piauí', now()),
  ('dirstore_way_413062142', 'dircomp_r_carvalho', 'Comercial Carvalho', 'way/413062142', -5.1071008, -42.7497542, 'Avenida Noé Mendes', 'Teresina', 'Piauí', now()),
  ('dirstore_way_1114921075', 'dircomp_r_carvalho', 'R Carvalho Morada Nova', 'way/1114921075', -5.127693, -42.7869283, 'Rua Agenor Veloso', 'Teresina', 'Piauí', now()),
  ('dirstore_way_1308879139', 'dircomp_r_carvalho', 'R Carvalho Pedra Mole', 'way/1308879139', -5.0184207, -42.7805745, 'Rua Ana Maria Gonçalves', 'Teresina, Piauí', 'Piauí', now()),
  ('dirstore_node_7821385632', 'dircomp_r_carvalho', 'R Carvalho Supermercado', 'node/7821385632', -5.128932, -42.8271968, 'Avenida Benedito Ferreira Campos, 734', 'Timon', 'Maranhão', now()),
  ('dirstore_node_7177651882', 'dircomp_r_carvalho', 'R Carvalho Supermercado', 'node/7177651882', -5.0871337, -42.8372221, 'Avenida Francisco Carlos Jansen', 'Timon', 'Maranhão', now()),
  ('dirstore_way_822069904', 'dircomp_r_carvalho', 'R. Carvalho - Kennedy', 'way/822069904', -5.0636257, -42.7707897, 'Avenida Presidente Kennedy', 'Teresina', 'Piauí', now())
ON CONFLICT ("osmId") DO NOTHING;
