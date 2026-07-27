import { generateTradeCatalogPagesFor } from "@/features/pdv-catalog/server/generate-pages";
import prisma from "@/lib/db";

// Popula o Cadastros de Trade com fotos e cria espaços reais de mapa em cada
// loja, para o Catálogo de PDV gerar uma página por mídia com uma linha por
// loja. Usa a MESMA função de geração da aplicação, então a demo não diverge
// do produto.

const ORG_SLUG = "gotham";

// Chaves R2 reais já usadas na org — garantem miniatura de verdade no catálogo.
const PHOTO_KEYS = [
  "4c50e155-e26f-4599-bb5a-0c7d0f996da1-2a1191_19694a6db7dd4b81ae6c78b243a21b18_mv2.webp",
  "015cfee3-54e2-43e4-b42b-c49043382329-coca-cola-em-prateleiras-34607923.webp",
  "782dc67f-37fc-4d5c-bdf9-07424ec547d4-20211105_pepsico_materia_2.jpg",
  "49ff463c-d9b7-4e61-ac6b-c93c8b961e3b-298e88af-aeea-451f-b338-04fd43813582.jpg",
  "57452752-a72a-49c2-996a-ec1dc06b8a8c-promotor-1784839740476.jpg",
  "aadb9ab6-debe-47cf-80b6-447c98c28a8a-promotor-1784843425097.jpg",
];

const TIERS = ["PREMIUM", "OURO", "PRATA", "BRONZE"] as const;
const FLOWS = ["MUITO_ALTO", "ALTO", "MEDIO", "BAIXO"] as const;
const VISIBILITIES = ["EXCELENTE", "BOA", "REGULAR"] as const;
const STATES = ["LIVRE", "EXECUTADO", "PENDENTE"] as const;

// Perfil de custo por loja: sem areaM2 + monthlyCost o preço sugerido é null e
// o catálogo sai sem valores.
const STORE_PROFILE = [
  { areaM2: 4200, monthlyCost: 385000 },
  { areaM2: 1800, monthlyCost: 210000 },
  { areaM2: 6500, monthlyCost: 430000 },
  { areaM2: 3100, monthlyCost: 265000 },
  { areaM2: 7800, monthlyCost: 510000 },
  { areaM2: 2400, monthlyCost: 190000 },
];

async function main() {
  const organization = await prisma.organization.findFirst({
    where: { slug: ORG_SLUG },
    select: { id: true },
  });
  if (!organization) throw new Error(`Org ${ORG_SLUG} não encontrada.`);
  const organizationId = organization.id;

  // ── 1. Fotos em todos os cadastros de mídia ────────────────────────────
  const mediaTypes = await prisma.mediaType.findMany({
    where: { organizationId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, name: true, basePrice: true },
  });

  for (const [index, mediaType] of mediaTypes.entries()) {
    // Duas fotos por mídia, rotacionando o pool para variar entre as páginas.
    const defaultPhotos = [
      PHOTO_KEYS[index % PHOTO_KEYS.length],
      PHOTO_KEYS[(index + 3) % PHOTO_KEYS.length],
    ];
    await prisma.mediaType.update({
      where: { id: mediaType.id },
      data: {
        defaultPhotos,
        // Sem basePrice, mídias sem espaço mapeado ficariam sem preço nenhum.
        basePrice: mediaType.basePrice ?? 1200 + (index % 8) * 350,
      },
    });
  }
  console.log(`fotos aplicadas em ${mediaTypes.length} mídias`);

  // ── 2. Perfil de custo + planta baixa por loja ─────────────────────────
  const stores = await prisma.store.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const layerByStore = new Map<string, string>();
  for (const [index, store] of stores.entries()) {
    const profile = STORE_PROFILE[index % STORE_PROFILE.length];
    await prisma.store.update({
      where: { id: store.id },
      data: { areaM2: profile.areaM2, monthlyCost: profile.monthlyCost },
    });

    const floorPlan =
      (await prisma.floorPlan.findFirst({
        where: { organizationId, storeId: store.id },
        select: { id: true },
      })) ??
      (await prisma.floorPlan.create({
        data: {
          organizationId,
          storeId: store.id,
          name: `Planta — ${store.name}`,
        },
        select: { id: true },
      }));

    const layer =
      (await prisma.mapLayer.findFirst({
        where: { floorPlanId: floorPlan.id },
        select: { id: true },
      })) ??
      (await prisma.mapLayer.create({
        data: {
          organizationId,
          floorPlanId: floorPlan.id,
          name: "Espaços comerciais",
        },
        select: { id: true },
      }));

    layerByStore.set(store.id, layer.id);
    // O gerador lê o objeto pelo floorPlan, então guardamos os dois juntos.
    layerByStore.set(`${store.id}:floorPlan`, floorPlan.id);
  }
  console.log(`plantas garantidas em ${stores.length} lojas`);

  // ── 3. Espaços mapeados: cada mídia presente em várias lojas ───────────
  let objectCount = 0;
  let priceCount = 0;
  for (const [mediaIndex, mediaType] of mediaTypes.entries()) {
    // Nem toda mídia existe em toda loja — isso é o que faz o catálogo ter
    // páginas com 6 lojas e outras com 3, como na vida real. O deslocamento
    // por mediaIndex evita que sejam sempre as mesmas lojas.
    const storeCount = 3 + (mediaIndex % 4);
    const storeSlice = Array.from({ length: storeCount }, (_, position) => {
      return stores[(position + mediaIndex) % stores.length];
    });

    for (const [storeIndex, store] of storeSlice.entries()) {
      const floorPlanId = layerByStore.get(`${store.id}:floorPlan`);
      const layerId = layerByStore.get(store.id);
      if (!floorPlanId || !layerId) continue;

      const existing = await prisma.mapObject.count({
        where: { floorPlanId, mediaTypeId: mediaType.id },
      });
      if (existing > 0) continue;

      const quantity = 1 + ((mediaIndex + storeIndex) % 3);
      for (let unit = 0; unit < quantity; unit++) {
        await prisma.mapObject.create({
          data: {
            organizationId,
            floorPlanId,
            layerId,
            type: "GONDOLA",
            shapeKind: "RECT",
            geometry: {
              kind: "RECT",
              x: 2 + ((mediaIndex * 3 + unit * 2) % 40),
              y: 2 + ((storeIndex * 4 + unit) % 30),
              width: 1.2 + ((mediaIndex + unit) % 4) * 0.6,
              height: 0.8 + ((storeIndex + unit) % 3) * 0.5,
              rotation: 0,
            },
            name: `${mediaType.name} ${unit + 1}`,
            mediaTypeId: mediaType.id,
            spaceState:
              STATES[(mediaIndex + storeIndex + unit) % STATES.length],
            tier: TIERS[(mediaIndex + storeIndex) % TIERS.length],
            flowLevel: FLOWS[(mediaIndex + unit) % FLOWS.length],
            visibility: VISIBILITIES[(storeIndex + unit) % VISIBILITIES.length],
          },
        });
        objectCount++;
      }

      // Preço manual em parte das combinações, para exercitar a precedência
      // manual > basePrice > sugerido do resolveDisplayPrice.
      if ((mediaIndex + storeIndex) % 3 === 0) {
        await prisma.mediaTypePrice.upsert({
          where: {
            storeId_mediaTypeId: {
              storeId: store.id,
              mediaTypeId: mediaType.id,
            },
          },
          create: {
            organizationId,
            storeId: store.id,
            mediaTypeId: mediaType.id,
            price: 900 + ((mediaIndex * 7 + storeIndex * 13) % 26) * 150,
          },
          update: {},
        });
        priceCount++;
      }
    }
  }
  console.log(`espaços criados: ${objectCount}, preços manuais: ${priceCount}`);

  // ── 4. Gera as páginas do catálogo pelo caminho da aplicação ───────────
  const catalog = await prisma.tradeCatalog.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!catalog) throw new Error("Nenhum catálogo de PDV encontrado.");

  const pageIds = await generateTradeCatalogPagesFor({
    catalogId: catalog.id,
    organizationId,
    mediaTypeIds: mediaTypes.map((mediaType) => mediaType.id),
  });
  console.log(`páginas geradas/atualizadas: ${pageIds.length}`);

  const pages = await prisma.tradeCatalogPage.findMany({
    where: { catalogId: catalog.id },
    select: { title: true, photoKeys: true, rows: true },
    orderBy: { order: "asc" },
    take: 5,
  });
  for (const page of pages) {
    const rows = (page.rows ?? []) as unknown[];
    console.log(
      `  ${page.title}: ${rows.length} lojas, ${page.photoKeys.length} fotos`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
