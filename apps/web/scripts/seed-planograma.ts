import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Cria produtos com dimensões (mm) e um planograma completo — gôndola de 2
// módulos, 5 prateleiras por módulo, itens posicionados com facings — para o
// editor de /trade/planograma abrir com conteúdo. Escreve direto via Prisma,
// mas respeita a mesma hierarquia/validações do bulk-save da aplicação.

const connectionString = process.env.SEED_DATABASE_URL;
if (!connectionString) throw new Error("Defina SEED_DATABASE_URL.");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ORG_SLUG = "gotham";
const OWNER_EMAIL = "novodev@gmail.com";

// Catálogo de SKUs com medidas reais aproximadas (unidade de venda, em mm).
const PRODUCTS = [
  {
    name: "Coca-Cola Lata 350ml",
    w: 66,
    h: 123,
    d: 66,
    price: 5.5,
    brand: "Coca-Cola",
  },
  {
    name: "Fanta Laranja Lata 350ml",
    w: 66,
    h: 123,
    d: 66,
    price: 5.0,
    brand: "Fanta",
  },
  {
    name: "Guaraná Antarctica 350ml",
    w: 66,
    h: 123,
    d: 66,
    price: 4.8,
    brand: "Guaraná Antarctica",
  },
  { name: "Skol Lata 350ml", w: 66, h: 123, d: 66, price: 4.2, brand: "Skol" },
  {
    name: "Brahma Lata 350ml",
    w: 66,
    h: 123,
    d: 66,
    price: 4.3,
    brand: "Brahma",
  },
  {
    name: "Coca-Cola PET 2L",
    w: 106,
    h: 327,
    d: 106,
    price: 10.9,
    brand: "Coca-Cola",
  },
  {
    name: "Del Valle Uva 1L",
    w: 90,
    h: 250,
    d: 60,
    price: 8.5,
    brand: "Del Valle",
  },
  {
    name: "Nescau 2.0 400g",
    w: 95,
    h: 175,
    d: 65,
    price: 12.9,
    brand: "Nescau",
  },
  { name: "KitKat 41,5g", w: 120, h: 20, d: 12, price: 3.9, brand: "KitKat" },
  {
    name: "Ninho Integral 380g",
    w: 100,
    h: 150,
    d: 60,
    price: 18.9,
    brand: "Ninho",
  },
  {
    name: "Ruffles Original 96g",
    w: 200,
    h: 300,
    d: 70,
    price: 9.9,
    brand: "Ruffles",
  },
  {
    name: "Doritos Queijo 84g",
    w: 200,
    h: 300,
    d: 70,
    price: 9.5,
    brand: "Doritos",
  },
  {
    name: "Omo Lavagem Perfeita 1,6kg",
    w: 210,
    h: 300,
    d: 90,
    price: 29.9,
    brand: "Omo",
  },
  { name: "Dove Sabonete 90g", w: 95, h: 35, d: 60, price: 3.5, brand: "Dove" },
  {
    name: "Pantene Shampoo 400ml",
    w: 75,
    h: 220,
    d: 45,
    price: 22.9,
    brand: "Pantene",
  },
  { name: "Ariel Pó 800g", w: 180, h: 260, d: 70, price: 19.9, brand: "Ariel" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const organization = await prisma.organization.findFirst({
    where: { slug: ORG_SLUG },
    select: { id: true },
  });
  if (!organization) throw new Error(`Org ${ORG_SLUG} não encontrada.`);
  const organizationId = organization.id;

  const owner = await prisma.user.findFirst({
    where: { email: OWNER_EMAIL },
    select: { id: true },
  });
  if (!owner) throw new Error(`Usuário ${OWNER_EMAIL} não encontrado.`);
  const createdById = owner.id;

  const brands = await prisma.brand.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });
  const brandByName = new Map(brands.map((brand) => [brand.name, brand.id]));

  // ── 1. Produtos com dimensões ──────────────────────────────────────────
  const productByName = new Map<
    string,
    { id: string; w: number; h: number; d: number }
  >();
  for (const [index, product] of PRODUCTS.entries()) {
    const slug = slugify(product.name);
    const existing = await prisma.product.findFirst({
      where: { organizationId, slug },
      select: { id: true },
    });
    const data = {
      organizationId,
      createdById,
      name: product.name,
      slug,
      salePrice: product.price,
      barcode: `789${String(1000000 + index).padStart(10, "0")}`,
      brandId: brandByName.get(product.brand) ?? null,
      widthMm: product.w,
      heightMm: product.h,
      depthMm: product.d,
    };
    const saved = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        })
      : await prisma.product.create({ data, select: { id: true } });
    productByName.set(product.name, {
      id: saved.id,
      w: product.w,
      h: product.h,
      d: product.d,
    });
  }
  console.log(`produtos garantidos: ${productByName.size}`);

  // ── 2. Planograma (idempotente pelo nome) ──────────────────────────────
  const planogramName = "Planograma Bebidas & Mercearia — Gotham";
  const existingPlanogram = await prisma.planogram.findFirst({
    where: { organizationId, name: planogramName },
    select: { id: true },
  });
  if (existingPlanogram) {
    // Zera a árvore para reconstruir limpo (cascata cobre módulos/prateleiras/itens).
    await prisma.planogramFixture.deleteMany({
      where: { planogramId: existingPlanogram.id },
    });
    await prisma.planogramItem.deleteMany({
      where: { planogramId: existingPlanogram.id },
    });
  }
  const planogram =
    existingPlanogram ??
    (await prisma.planogram.create({
      data: {
        organizationId,
        name: planogramName,
        code: "PLN-001",
        status: "ATIVO",
        isActive: true,
        currentVersion: 1,
        createdById,
      },
      select: { id: true },
    }));

  // ── 3. Gôndola de 2 módulos, 5 prateleiras cada ────────────────────────
  const MODULE_WIDTH = 1300;
  const fixture = await prisma.planogramFixture.create({
    data: {
      organizationId,
      planogramId: planogram.id,
      kind: "GONDOLA",
      name: "Gôndola Corredor 3",
      order: 0,
      widthMm: MODULE_WIDTH * 2,
      heightMm: 1900,
      depthMm: 400,
      baseHeightMm: 100,
      colorHex: "#94a3b8",
    },
    select: { id: true },
  });

  // Distribui os produtos por "andar": bebidas embaixo, mercearia/higiene em cima.
  const productNames = PRODUCTS.map((product) => product.name);
  const SHELF_Y = [200, 520, 900, 1250, 1600]; // topo da prateleira a partir do piso
  let itemCount = 0;
  let shelfCount = 0;

  for (let moduleIndex = 0; moduleIndex < 2; moduleIndex++) {
    const planogramModule = await prisma.planogramModule.create({
      data: {
        organizationId,
        fixtureId: fixture.id,
        index: moduleIndex,
        widthMm: MODULE_WIDTH,
        label: `Módulo ${moduleIndex + 1}/2`,
      },
      select: { id: true },
    });

    for (let shelfIndex = 0; shelfIndex < SHELF_Y.length; shelfIndex++) {
      const shelf = await prisma.planogramShelf.create({
        data: {
          organizationId,
          moduleId: planogramModule.id,
          index: shelfIndex,
          yMm: SHELF_Y[shelfIndex],
          widthMm: MODULE_WIDTH,
          depthMm: 400,
          thicknessMm: 25,
          kind: "PRATELEIRA",
          layoutMode: "PACKED",
        },
        select: { id: true },
      });
      shelfCount++;

      // Preenche a prateleira com produtos até estourar a largura do módulo.
      let usedWidth = 0;
      let position = 0;
      const startIndex =
        (moduleIndex * SHELF_Y.length + shelfIndex) % productNames.length;
      for (let offset = 0; offset < productNames.length; offset++) {
        const product = productByName.get(
          productNames[(startIndex + offset) % productNames.length],
        );
        if (!product) continue;
        const facings = product.w < 80 ? 3 : product.w < 150 ? 2 : 1;
        const blockWidth = product.w * facings + 10;
        if (usedWidth + blockWidth > MODULE_WIDTH) break;

        await prisma.planogramItem.create({
          data: {
            organizationId,
            planogramId: planogram.id,
            shelfId: shelf.id,
            productId: product.id,
            position,
            facings,
            facingsDeep: 1,
            facingsHigh: 1,
            orientation: "FRENTE",
            isBoxed: false,
            widthMm: product.w,
            heightMm: product.h,
            depthMm: product.d,
          },
        });
        usedWidth += blockWidth;
        position++;
        itemCount++;
      }
    }
  }

  // ── 4. Versão inicial (snapshot p/ o histórico de revisões) ────────────
  const facingTotal = await prisma.planogramItem.aggregate({
    where: { planogramId: planogram.id },
    _sum: { facings: true },
  });
  await prisma.planogramVersion.upsert({
    where: {
      // sem unique composto exposto; usamos findFirst+create manual
      id: `${planogram.id}-v1`,
    },
    create: {
      id: `${planogram.id}-v1`,
      organizationId,
      planogramId: planogram.id,
      version: 1,
      label: "Versão inicial (seed)",
      snapshot: { note: "gerado pelo seed" },
      itemCount,
      facingCount: facingTotal._sum.facings ?? 0,
      linearMm: MODULE_WIDTH * shelfCount,
      createdById,
    },
    update: {},
  });

  console.log(
    `planograma: 1 gôndola, 2 módulos, ${shelfCount} prateleiras, ${itemCount} itens`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
