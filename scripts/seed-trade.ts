import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  DEFAULT_MEDIA_TYPES,
  DEFAULT_NEGOTIATION_TYPES,
  DEFAULT_STORE_SECTORS,
} from "@/features/trade-catalog/lib/defaults";

// Conexão explícita: o `.env.local` do worktree aponta para o Postgres local e
// vence o `.env`, então sem isso o seed escreve no banco errado.
const connectionString = process.env.SEED_DATABASE_URL;
if (!connectionString) {
  throw new Error("Defina SEED_DATABASE_URL antes de rodar o seed.");
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ORG_SLUG = "gotham";
const OWNER_EMAIL = "novodev@gmail.com";

const BRANDS_BY_SUPPLIER: Record<string, string[]> = {
  "Nestlé Brasil": ["Nescau", "KitKat", "Ninho"],
  "Unilever Brasil": ["Omo", "Dove", "Kibon"],
  "Coca-Cola FEMSA": ["Coca-Cola", "Fanta", "Del Valle"],
  Ambev: ["Skol", "Brahma", "Guaraná Antarctica"],
  "PepsiCo Brasil": ["Ruffles", "Doritos", "Gatorade"],
  "Procter & Gamble": ["Pantene", "Ariel", "Gillette"],
};

const MONTHS = [
  { periodMonth: 5, periodYear: 2026 },
  { periodMonth: 6, periodYear: 2026 },
  { periodMonth: 7, periodYear: 2026 },
];

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

  // ── Catálogos do Trade (mesmos defaults do hook de criação de org) ──────
  const media = await prisma.mediaType.createMany({
    data: DEFAULT_MEDIA_TYPES.map((mediaType, index) => ({
      organizationId,
      kind: mediaType.kind,
      code: mediaType.code,
      name: mediaType.name,
      pricingBasis: mediaType.pricingBasis ?? "AREA",
      sortOrder: index,
      isSystemDefault: true,
    })),
    skipDuplicates: true,
  });
  const negotiation = await prisma.negotiationType.createMany({
    data: DEFAULT_NEGOTIATION_TYPES.map((type, index) => ({
      organizationId,
      code: type.code,
      name: type.name,
      sortOrder: index,
      isSystemDefault: true,
    })),
    skipDuplicates: true,
  });
  const sector = await prisma.storeSector.createMany({
    data: DEFAULT_STORE_SECTORS.map((storeSector, index) => ({
      organizationId,
      code: storeSector.code,
      name: storeSector.name,
      sortOrder: index,
      isSystemDefault: true,
    })),
    skipDuplicates: true,
  });
  console.log(
    `catálogos: ${media.count} mídias, ${negotiation.count} negociações, ${sector.count} setores`,
  );

  // ── Marcas por indústria ────────────────────────────────────────────────
  const suppliers = await prisma.supplier.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });
  let brandCount = 0;
  for (const supplier of suppliers) {
    for (const brandName of BRANDS_BY_SUPPLIER[supplier.name] ?? []) {
      const existing = await prisma.brand.findFirst({
        where: { organizationId, supplierId: supplier.id, name: brandName },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.brand.create({
        data: {
          organizationId,
          supplierId: supplier.id,
          name: brandName,
        },
      });
      brandCount++;
    }
  }
  console.log(`marcas criadas: ${brandCount}`);

  // ── Books de PDV ────────────────────────────────────────────────────────
  // Um book por indústria/período, montado com as fotos daquela indústria.
  const photos = await prisma.pdvPhoto.findMany({
    where: { organizationId, supplierId: { not: null } },
    select: { id: true, supplierId: true, approvalStatus: true },
    orderBy: { capturedAt: "desc" },
  });

  let bookCount = 0;
  let itemCount = 0;
  for (const [index, supplier] of suppliers.entries()) {
    const period = MONTHS[index % MONTHS.length];
    const name = `Book de PDV — ${supplier.name} — ${String(period.periodMonth).padStart(2, "0")}/${period.periodYear}`;

    const alreadyThere = await prisma.book.findFirst({
      where: { organizationId, name },
      select: { id: true },
    });
    if (alreadyThere) continue;

    const supplierPhotos = photos.filter(
      (photo) => photo.supplierId === supplier.id,
    );
    if (supplierPhotos.length === 0) continue;

    // Dois books enviados, o resto em rascunho, para o painel ter variedade.
    const isSent = index < 2;
    const book = await prisma.book.create({
      data: {
        organizationId,
        name,
        supplierId: supplier.id,
        periodMonth: period.periodMonth,
        periodYear: period.periodYear,
        status: isSent ? "READY" : "DRAFT",
        sentAt: isSent ? new Date() : null,
        sentByName: isSent ? "Coordenação Órbita" : null,
        createdById,
      },
      select: { id: true },
    });
    bookCount++;

    for (const [order, photo] of supplierPhotos.entries()) {
      await prisma.bookItem.create({
        data: {
          bookId: book.id,
          pdvPhotoId: photo.id,
          order,
          approvalStatus: photo.approvalStatus,
        },
      });
      itemCount++;
    }
  }
  console.log(`books criados: ${bookCount} (${itemCount} páginas/fotos)`);

  // ── Catálogo de PDV (trade) ─────────────────────────────────────────────
  const catalogName = "Catálogo de PDV — Gotham 2026";
  const existingCatalog = await prisma.tradeCatalog.findFirst({
    where: { organizationId, name: catalogName },
    select: { id: true },
  });
  if (!existingCatalog) {
    const mediaTypes = await prisma.mediaType.findMany({
      where: { organizationId },
      select: { code: true, name: true },
      orderBy: { sortOrder: "asc" },
      take: 6,
    });
    const catalog = await prisma.tradeCatalog.create({
      data: {
        organizationId,
        name: catalogName,
        status: "DRAFT",
        shareToken: `gotham-${Date.now().toString(36)}`,
        isPublic: false,
        createdById,
      },
      select: { id: true },
    });
    for (const [order, mediaType] of mediaTypes.entries()) {
      await prisma.tradeCatalogPage.create({
        data: {
          catalogId: catalog.id,
          title: mediaType.name,
          mediaTypeCode: mediaType.code,
          order,
        },
      });
    }
    console.log(`catálogo de PDV criado com ${mediaTypes.length} páginas`);
  } else {
    console.log("catálogo de PDV já existia");
  }

  const totals = await Promise.all([
    prisma.book.count({ where: { organizationId } }),
    prisma.bookItem.count({ where: { book: { organizationId } } }),
    prisma.brand.count({ where: { organizationId } }),
    prisma.mediaType.count({ where: { organizationId } }),
    prisma.tradeCatalog.count({ where: { organizationId } }),
  ]);
  console.log(
    `TOTAIS — books: ${totals[0]}, itens: ${totals[1]}, marcas: ${totals[2]}, mídias: ${totals[3]}, catálogos: ${totals[4]}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
