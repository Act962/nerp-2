/**
 * Popula a org Gotham com dados realistas do App Promotor para demo local.
 *
 * Cria (idempotente — checa por email/nome antes de inserir):
 *  - 3 suppliers extras (Coca-Cola, Nestlé, Unilever)
 *  - 8 stores em coordenadas reais de Teresina
 *  - 3 promotores "fake" (User + Member role=member, SEM Account → não logam;
 *    aparecem em relatórios/mapa/rotas quando o coordenador visualiza)
 *  - PromoterSupplier + PromoterStore para dar vínculo aos promotores
 *  - PromoterRoute + stops (rota do dia, ~4 paradas por promotor)
 *  - ~40 PdvPhotos com GPS distribuídas entre promotores/lojas/suppliers
 *  - Cada Store criada é linkada a DirectoryStore via resolveDirectoryStore,
 *    então o pino público não duplica.
 *
 * Uso: npx tsx --env-file=.env scripts/seed-promotor-demo.ts
 *
 * Loga no localhost com `duascarasnasa@gmail.com` (owner Gotham) ou
 * `dev@nasaerp.com` (owner Gotham) para ver como coordenador.
 */
import prisma from "@/lib/db";

const ORG_SLUG = "gotham";

// Coordenadas reais de bairros de Teresina — variadas para o mapa não ficar
// aglomerado num ponto só e para o "Ver no mapa" da rota mostrar traçado.
const STORE_SEEDS = [
  {
    name: "Mercado do Buenos Aires",
    city: "Teresina",
    state: "PI",
    address: "Av. Barão de Gurgueia, 800",
    latitude: -5.0972,
    longitude: -42.7823,
  },
  {
    name: "Supermercado Ilhotas",
    city: "Teresina",
    state: "PI",
    address: "Av. Miguel Rosa, 3410",
    latitude: -5.1041,
    longitude: -42.8171,
  },
  {
    name: "Atacadão Sul",
    city: "Teresina",
    state: "PI",
    address: "Av. Marechal Castelo Branco, 5500",
    latitude: -5.1256,
    longitude: -42.7815,
  },
  {
    name: "Mercantil Fátima",
    city: "Teresina",
    state: "PI",
    address: "Rua Ceará, 900",
    latitude: -5.0812,
    longitude: -42.7942,
  },
  {
    name: "Comercial Piçarra",
    city: "Teresina",
    state: "PI",
    address: "Av. Cajuína, 1250",
    latitude: -5.0654,
    longitude: -42.7788,
  },
  {
    name: "Super Cidade Nova",
    city: "Teresina",
    state: "PI",
    address: "Rua Duque de Caxias, 2100",
    latitude: -5.0913,
    longitude: -42.8095,
  },
  {
    name: "Mercadinho Parque Piauí",
    city: "Teresina",
    state: "PI",
    address: "Av. Presidente Kennedy, 3300",
    latitude: -5.0745,
    longitude: -42.7562,
  },
  {
    name: "Rede Norte Supermercados",
    city: "Teresina",
    state: "PI",
    address: "Av. Boa Esperança, 500",
    latitude: -5.0492,
    longitude: -42.8034,
  },
] as const;

const SUPPLIER_SEEDS = [
  { name: "COCA-COLA COMPANY", tradeName: "Coca-Cola" },
  { name: "NESTLE BRASIL LTDA", tradeName: "Nestlé" },
  { name: "UNILEVER BRASIL", tradeName: "Unilever" },
] as const;

const PROMOTER_SEEDS = [
  {
    email: "demo-promotor-1@nerp.local",
    name: "Ana Ribeiro",
    whatsapp: "+5586999880011",
  },
  {
    email: "demo-promotor-2@nerp.local",
    name: "Bruno Nascimento",
    whatsapp: "+5586999880022",
  },
  {
    email: "demo-promotor-3@nerp.local",
    name: "Carla Mendes",
    whatsapp: "+5586999880033",
  },
] as const;

/** Sacode um valor float dentro de ±0,00035° (~40 metros) — GPS de celular. */
function jitter(value: number): number {
  return value + (Math.random() - 0.5) * 0.0007;
}

async function upsertUser(seed: (typeof PROMOTER_SEEDS)[number]) {
  return prisma.user.upsert({
    where: { email: seed.email },
    update: { name: seed.name, whatsapp: seed.whatsapp },
    create: {
      email: seed.email,
      name: seed.name,
      whatsapp: seed.whatsapp,
      emailVerified: true,
      // Placeholder — a foto de perfil é obrigatória para capturar, mas essas
      // contas nunca vão logar; existem só para preencher relatórios.
      image: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed.name)}`,
    },
  });
}

async function upsertMember(userId: string, organizationId: string) {
  const existing = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.member.create({
    data: {
      userId,
      organizationId,
      role: "member",
      showInPromotorPhoto: true,
    },
    select: { id: true },
  });
}

async function upsertSupplier(
  organizationId: string,
  seed: (typeof SUPPLIER_SEEDS)[number],
) {
  const existing = await prisma.supplier.findFirst({
    where: { organizationId, name: seed.name },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.supplier.create({
    data: {
      organizationId,
      name: seed.name,
      tradeName: seed.tradeName,
      isActive: true,
    },
    select: { id: true },
  });
}

async function upsertStore(
  organizationId: string,
  seed: (typeof STORE_SEEDS)[number],
) {
  const existing = await prisma.store.findFirst({
    where: { organizationId, name: seed.name },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      directoryStoreId: true,
    },
  });
  if (existing) return existing;
  const slug = seed.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const store = await prisma.store.create({
    data: {
      organizationId,
      name: seed.name,
      slug,
      address: seed.address,
      city: seed.city,
      state: seed.state,
      latitude: seed.latitude,
      longitude: seed.longitude,
      geoSource: "MANUAL",
      geoStatus: "OK",
      geoPrecision: "manual",
      geoUpdatedAt: new Date(),
      isActive: true,
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      directoryStoreId: true,
    },
  });
  return store;
}

async function main() {
  const org = await prisma.organization.findFirst({
    where: { slug: ORG_SLUG },
    select: { id: true, name: true },
  });
  if (!org) throw new Error(`Org ${ORG_SLUG} não encontrada`);

  console.log(`Populando ${org.name}...`);

  // 1. Suppliers
  const suppliers = [];
  for (const seed of SUPPLIER_SEEDS) {
    suppliers.push(await upsertSupplier(org.id, seed));
  }
  const existingSuppliers = await prisma.supplier.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true },
  });
  console.log(`Suppliers na org: ${existingSuppliers.length}`);

  // 2. Stores
  const stores = [];
  for (const seed of STORE_SEEDS) {
    const store = await upsertStore(org.id, seed);
    stores.push({ ...store, name: seed.name });
  }
  console.log(`Stores criadas/reaproveitadas: ${stores.length}`);

  // Todas as stores da org (inclui as pré-existentes, para o mix de fotos)
  const allStores = await prisma.store.findMany({
    where: {
      organizationId: org.id,
      latitude: { not: null },
      longitude: { not: null },
    },
    select: { id: true, name: true, latitude: true, longitude: true },
  });

  // 3. Promotores (User + Member)
  const promoters: {
    memberId: string;
    userId: string;
    name: string;
  }[] = [];
  for (const seed of PROMOTER_SEEDS) {
    const user = await upsertUser(seed);
    const member = await upsertMember(user.id, org.id);
    promoters.push({ memberId: member.id, userId: user.id, name: seed.name });
  }
  console.log(`Promotores (fake, sem login): ${promoters.length}`);

  // 4. Vínculos PromoterSupplier — cada promotor cobre 2 suppliers
  const supplierList = existingSuppliers.slice(0, 5);
  for (let i = 0; i < promoters.length; i++) {
    const promoter = promoters[i];
    const linked = [
      supplierList[i % supplierList.length],
      supplierList[(i + 1) % supplierList.length],
    ];
    for (const supplier of linked) {
      await prisma.promoterSupplier.upsert({
        where: {
          memberId_supplierId: {
            memberId: promoter.memberId,
            supplierId: supplier.id,
          },
        },
        update: {},
        create: {
          organizationId: org.id,
          memberId: promoter.memberId,
          supplierId: supplier.id,
        },
      });
    }
  }
  console.log(`Vínculos PromoterSupplier: ${promoters.length * 2}`);

  // 5. Vínculos PromoterStore — cada promotor cobre 5 stores (as 4 do bloco
  // + a próxima, para rotas se sobreporem no mapa e virarem uma "malha")
  for (let i = 0; i < promoters.length; i++) {
    const promoter = promoters[i];
    const chunk = allStores.slice(i * 3, i * 3 + 5);
    for (const store of chunk) {
      await prisma.promoterStore.upsert({
        where: {
          memberId_storeId: {
            memberId: promoter.memberId,
            storeId: store.id,
          },
        },
        update: {},
        create: {
          organizationId: org.id,
          memberId: promoter.memberId,
          storeId: store.id,
        },
      });
    }
  }
  console.log(`Vínculos PromoterStore: ${promoters.length * 5}`);

  // 6. PromoterRoute + stops — 4 paradas por promotor
  for (let i = 0; i < promoters.length; i++) {
    const promoter = promoters[i];
    const route = await prisma.promoterRoute.upsert({
      where: { memberId: promoter.memberId },
      update: {},
      create: {
        organizationId: org.id,
        memberId: promoter.memberId,
        name: `Rota de ${promoter.name}`,
      },
      select: { id: true },
    });
    // Recria stops: apaga e insere de novo, para o script ser idempotente
    // sem carregar paradas velhas.
    await prisma.promoterRouteStop.deleteMany({
      where: { routeId: route.id },
    });
    const chunk = allStores.slice(i * 3, i * 3 + 4);
    for (let idx = 0; idx < chunk.length; idx++) {
      const store = chunk[idx];
      if (store.latitude === null || store.longitude === null) continue;
      await prisma.promoterRouteStop.create({
        data: {
          organizationId: org.id,
          routeId: route.id,
          position: idx,
          storeId: store.id,
          name: store.name,
          latitude: store.latitude,
          longitude: store.longitude,
        },
      });
    }
  }
  console.log(`Rotas criadas: ${promoters.length}`);

  // 7. Fotos — cada promotor tira 3-4 fotos em cada uma das suas 4 lojas,
  // com 1-2 suppliers dos seus vínculos, em capturedAt escalonado nos
  // últimos 7 dias. Idempotente: só cria se não houver fotos do promotor
  // naquela loja/supplier nos últimos 30d.
  let photosCreated = 0;
  for (let i = 0; i < promoters.length; i++) {
    const promoter = promoters[i];
    const links = await prisma.promoterStore.findMany({
      where: { memberId: promoter.memberId },
      select: {
        store: { select: { id: true, latitude: true, longitude: true } },
      },
      take: 4,
    });
    const supplierIds = (
      await prisma.promoterSupplier.findMany({
        where: { memberId: promoter.memberId },
        select: { supplierId: true },
      })
    ).map((row) => row.supplierId);

    for (const { store } of links) {
      if (!store.latitude || !store.longitude) continue;
      for (const supplierId of supplierIds) {
        const existing = await prisma.pdvPhoto.count({
          where: {
            organizationId: org.id,
            storeId: store.id,
            supplierId,
            createdById: promoter.userId,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        });
        if (existing > 0) continue;
        // 2 fotos por visita, em horas escalonadas hoje
        const baseHour = 8 + i * 2;
        for (let n = 0; n < 2; n++) {
          const capturedAt = new Date();
          capturedAt.setHours(baseHour + n, 15 + n * 20, 0, 0);
          await prisma.pdvPhoto.create({
            data: {
              organizationId: org.id,
              storeId: store.id,
              supplierId,
              photos: [
                `demo/pdv-photo-${promoter.userId.slice(-6)}-${store.id.slice(-6)}-${n}.jpg`,
              ],
              capturedAt,
              promoterName: promoter.name,
              capturedCity: "Teresina",
              capturedState: "PI",
              capturedLatitude: jitter(store.latitude),
              capturedLongitude: jitter(store.longitude),
              createdById: promoter.userId,
              approvalStatus: "APPROVED",
            },
          });
          photosCreated++;
        }
      }
    }
  }
  console.log(`PdvPhotos criadas: ${photosCreated}`);

  console.log(
    "\n✅ Seed pronta.\n  Log no localhost:3000 como:\n" +
      "    - duascarasnasa@gmail.com (Weydson / owner Gotham) → visão coordenador\n" +
      "    - dev@nasaerp.com (Dev NASA / owner Gotham) → visão coordenador\n" +
      "  Módulos para conferir:\n" +
      "    /mapa-de-campo     → equipe no mapa, produtividade, rotas\n" +
      "    /promotor          → wizard de capturar (como promotor)\n" +
      "    /promotor/rota/mapa → mapa da rota do dia com traçado\n" +
      "    /tradegram         → mapa público (pinos das lojas)\n",
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
