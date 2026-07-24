/**
 * Seed de demonstração do planograma: cria produtos de limpeza com medidas e
 * marcas reais, monta uma gôndola 1,30 × 1,90 m com 5 prateleiras e posiciona
 * tudo usando o MESMO engine que o editor usa (buildShelvesForFixture +
 * packShelf) — a demo não pode divergir do produto.
 *
 * Uso: npx tsx --env-file=.env scripts/seed-planogram-demo.ts
 */
import {
  buildShelvesForFixture,
  FIXTURE_PRESETS_BY_ID,
} from "@/features/planogram/engine/fixture-presets";
import prisma from "@/lib/db";

const ORG_ID = "SX99VyjCVlkXq8R9uTGC05bTTaoywraV"; // Gotham

// Medidas aproximadas de embalagens reais de lavanderia (mm).
const CATALOG = [
  {
    brand: "OMO",
    name: "OMO Lava-Roupas Líquido 3L",
    w: 150,
    h: 290,
    d: 95,
    ean: "7891150064126",
    shelf: 0,
    facings: 3,
  },
  {
    brand: "OMO",
    name: "OMO Lava-Roupas Líquido 1,6L",
    w: 120,
    h: 245,
    d: 80,
    ean: "7891150064133",
    shelf: 0,
    facings: 2,
  },
  {
    brand: "OMO",
    name: "OMO Sabão em Pó 1,6kg",
    w: 175,
    h: 250,
    d: 70,
    ean: "7891150081376",
    shelf: 0,
    facings: 2,
  },
  {
    brand: "ARIEL",
    name: "Ariel Líquido 3L",
    w: 150,
    h: 290,
    d: 95,
    ean: "7506339397154",
    shelf: 0,
    facings: 2,
  },

  {
    brand: "BRILHANTE",
    name: "Brilhante Líquido 3L",
    w: 148,
    h: 288,
    d: 94,
    ean: "7891150025943",
    shelf: 1,
    facings: 3,
  },
  {
    brand: "BRILHANTE",
    name: "Brilhante Sabão em Pó 1,6kg",
    w: 175,
    h: 250,
    d: 70,
    ean: "7891150025950",
    shelf: 1,
    facings: 2,
  },
  {
    brand: "TIXAN",
    name: "Tixan Ypê Líquido 3L",
    w: 152,
    h: 292,
    d: 96,
    ean: "7896098900154",
    shelf: 1,
    facings: 2,
  },
  {
    brand: "TIXAN",
    name: "Tixan Ypê Pó 2kg",
    w: 190,
    h: 265,
    d: 75,
    ean: "7896098900161",
    shelf: 1,
    facings: 1,
  },

  {
    brand: "SURF",
    name: "Surf Líquido 3L",
    w: 148,
    h: 285,
    d: 92,
    ean: "7891150055551",
    shelf: 2,
    facings: 3,
  },
  {
    brand: "SURF",
    name: "Surf Sabão em Pó 1,6kg",
    w: 175,
    h: 248,
    d: 70,
    ean: "7891150055568",
    shelf: 2,
    facings: 2,
  },
  {
    brand: "ARIEL",
    name: "Ariel Sabão em Pó 1,6kg",
    w: 176,
    h: 252,
    d: 71,
    ean: "7506339397161",
    shelf: 2,
    facings: 2,
  },

  {
    brand: "COMFORT",
    name: "Comfort Amaciante 2L",
    w: 135,
    h: 265,
    d: 88,
    ean: "7891150042230",
    shelf: 3,
    facings: 3,
  },
  {
    brand: "DOWNY",
    name: "Downy Amaciante 2L",
    w: 133,
    h: 262,
    d: 87,
    ean: "7506295380023",
    shelf: 3,
    facings: 3,
  },
  {
    brand: "MON BIJOU",
    name: "Mon Bijou Amaciante 2L",
    w: 136,
    h: 266,
    d: 88,
    ean: "7891038000133",
    shelf: 3,
    facings: 3,
  },

  {
    brand: "VANISH",
    name: "Vanish Tira-Manchas 1L",
    w: 105,
    h: 235,
    d: 70,
    ean: "7891035000324",
    shelf: 4,
    facings: 3,
  },
  {
    brand: "OMO",
    name: "OMO Sachê Líquido 900ml",
    w: 130,
    h: 200,
    d: 45,
    ean: "7891150087415",
    shelf: 4,
    facings: 3,
  },
  {
    brand: "BRILHANTE",
    name: "Brilhante Sachê 900ml",
    w: 130,
    h: 200,
    d: 45,
    ean: "7891150087422",
    shelf: 4,
    facings: 3,
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function requireProductId(products: Map<string, string>, ean: string): string {
  const id = products.get(ean);
  if (!id) throw new Error(`Produto do EAN ${ean} não foi criado`);
  return id;
}

async function main() {
  const owner = await prisma.member.findFirstOrThrow({
    where: { organizationId: ORG_ID, role: "owner" },
    select: { userId: true },
  });

  // Categoria alvo (Sub-Segmento) com hierarquia coerente.
  const limpeza = await prisma.category.upsert({
    where: { organizationId_slug: { organizationId: ORG_ID, slug: "limpeza" } },
    create: {
      organizationId: ORG_ID,
      name: "LIMPEZA",
      slug: "limpeza",
      level: 0,
      path: null,
    },
    update: {},
  });
  await prisma.category.update({
    where: { id: limpeza.id },
    data: { path: limpeza.id },
  });

  const lavanderia = await prisma.category.upsert({
    where: {
      organizationId_slug: { organizationId: ORG_ID, slug: "lavanderia" },
    },
    create: {
      organizationId: ORG_ID,
      name: "LAVANDERIA",
      slug: "lavanderia",
      parentId: limpeza.id,
      level: 1,
    },
    update: { parentId: limpeza.id, level: 1 },
  });
  await prisma.category.update({
    where: { id: lavanderia.id },
    data: { path: `${limpeza.id}/${lavanderia.id}` },
  });

  // Marcas
  const brandNames = [...new Set(CATALOG.map((p) => p.brand))];
  const brands = new Map<string, string>();
  for (const name of brandNames) {
    const existing = await prisma.brand.findFirst({
      where: { organizationId: ORG_ID, name },
      select: { id: true },
    });
    const brand =
      existing ??
      (await prisma.brand.create({
        data: { organizationId: ORG_ID, name }, // supplierId agora é opcional
        select: { id: true },
      }));
    brands.set(name, brand.id);
  }
  console.log(`Marcas: ${brands.size}`);

  // Produtos (upsert por EAN — a chave natural criada na Fase 0)
  const products = new Map<string, string>();
  for (const entry of CATALOG) {
    const product = await prisma.product.upsert({
      where: {
        organizationId_barcode: { organizationId: ORG_ID, barcode: entry.ean },
      },
      create: {
        organizationId: ORG_ID,
        name: entry.name,
        slug: slugify(entry.name),
        barcode: entry.ean,
        categoryId: lavanderia.id,
        brandId: brands.get(entry.brand),
        costPrice: 10,
        salePrice: 20,
        currentStock: 50,
        minStock: 5,
        widthMm: entry.w,
        heightMm: entry.h,
        depthMm: entry.d,
        images: [],
        createdById: owner.userId,
      },
      update: {
        widthMm: entry.w,
        heightMm: entry.h,
        depthMm: entry.d,
        brandId: brands.get(entry.brand),
        categoryId: lavanderia.id,
      },
      select: { id: true },
    });
    products.set(entry.ean, product.id);
  }
  console.log(`Produtos: ${products.size}`);

  // Planograma
  await prisma.planogram.deleteMany({
    where: { organizationId: ORG_ID, code: "DEMO-LAV" },
  });
  const planogram = await prisma.planogram.create({
    data: {
      organizationId: ORG_ID,
      name: "Lavanderia — Loja Modelo",
      code: "DEMO-LAV",
      categoryId: lavanderia.id,
      status: "RASCUNHO",
      createdById: owner.userId,
    },
    select: { id: true },
  });

  const preset = FIXTURE_PRESETS_BY_ID.get("gondola-1300x1900");
  if (!preset) throw new Error("Preset gondola-1300x1900 não existe mais");
  const fixture = await prisma.planogramFixture.create({
    data: {
      organizationId: ORG_ID,
      planogramId: planogram.id,
      kind: "GONDOLA",
      name: "Gôndola Lavanderia",
      order: 0,
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
      depthMm: preset.depthMm,
      baseHeightMm: preset.baseHeightMm,
    },
    select: { id: true },
  });
  const moduleNode = await prisma.planogramModule.create({
    data: {
      organizationId: ORG_ID,
      fixtureId: fixture.id,
      index: 0,
      widthMm: preset.widthMm,
    },
    select: { id: true },
  });

  const shelfSpecs = buildShelvesForFixture(preset, moduleNode.id);
  const shelfIds: string[] = [];
  for (const spec of shelfSpecs) {
    const shelf = await prisma.planogramShelf.create({
      data: {
        organizationId: ORG_ID,
        moduleId: moduleNode.id,
        index: spec.index,
        yMm: spec.yMm,
        widthMm: spec.widthMm,
        depthMm: spec.depthMm,
        thicknessMm: spec.thicknessMm,
        kind: spec.kind,
        layoutMode: spec.layoutMode,
        dividers: [],
      },
      select: { id: true },
    });
    shelfIds.push(shelf.id);
  }

  let placed = 0;
  for (const [index, shelfId] of shelfIds.entries()) {
    const forShelf = CATALOG.filter((entry) => entry.shelf === index);
    let position = 0;
    let usedMm = 0;
    for (const entry of forShelf) {
      const width = entry.w * entry.facings;
      // Não estoura a prateleira no seed: a demo tem que abrir sem alerta.
      if (usedMm + width > preset.widthMm) continue;
      await prisma.planogramItem.create({
        data: {
          organizationId: ORG_ID,
          planogramId: planogram.id,
          shelfId,
          productId: requireProductId(products, entry.ean),
          position,
          facings: entry.facings,
          widthMm: entry.w,
          heightMm: entry.h,
          depthMm: entry.d,
        },
      });
      usedMm += width;
      position++;
      placed++;
    }
    const skipped = forShelf.length - position;
    const pct = Math.round((usedMm / preset.widthMm) * 100);
    console.log(
      `  prateleira ${index + 1}: ${position} de ${forShelf.length} produtos, ` +
        `ocupação ${usedMm}/${preset.widthMm}mm (${pct}%)` +
        (skipped > 0 ? ` — ${skipped} não coube` : ""),
    );
  }

  console.log(`\nPlanograma: Lavanderia — Loja Modelo`);
  console.log(`  id=${planogram.id}`);
  console.log(`  itens posicionados: ${placed}`);
  console.log(`  URL: /trade/planograma/${planogram.id}/editar`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
