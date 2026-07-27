/**
 * Migra MapObject.category (texto livre, legado) para sectorId (catálogo
 * padronizado da Fase 2). Uso: pnpm dlx tsx scripts/backfill-sector-from-category.ts
 *
 * Casa por nome normalizado (sem acento/case/pontuação) contra os StoreSector
 * já semeados na org — roda o backfill-trade-catalogs.ts antes deste, senão
 * toda org sem catálogo backfilla zero setores. Nunca cria setor a partir de
 * texto livre: "bebidas"/"Bebida"/"BEBIDAS " virariam três setores. Sem
 * match, o objeto fica com sectorId null e o valor órfão é impresso no fim.
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizeForMatch } from "../src/features/store-map/engine/space-code";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
  });
  console.log(
    `Backfilling setor de ${organizations.length} organização(ões)...`,
  );

  const orphans = new Map<string, number>();
  let matched = 0;
  let skipped = 0;

  for (const organization of organizations) {
    const sectors = await prisma.storeSector.findMany({
      where: { organizationId: organization.id },
      select: { id: true, name: true },
    });
    if (sectors.length === 0) {
      console.log(
        `  ⚠ ${organization.name}: sem StoreSector semeado, pulando (rode backfill-trade-catalogs.ts primeiro)`,
      );
      continue;
    }
    const sectorByNormalizedName = new Map(
      sectors.map((sector) => [normalizeForMatch(sector.name), sector.id]),
    );

    const objects = await prisma.mapObject.findMany({
      where: {
        organizationId: organization.id,
        sectorId: null,
        category: { not: null },
      },
      select: { id: true, category: true },
    });

    for (const object of objects) {
      if (!object.category) continue;
      const sectorId = sectorByNormalizedName.get(
        normalizeForMatch(object.category),
      );
      if (!sectorId) {
        orphans.set(object.category, (orphans.get(object.category) ?? 0) + 1);
        skipped++;
        continue;
      }
      await prisma.mapObject.update({
        where: { id: object.id },
        data: { sectorId },
      });
      matched++;
    }
    console.log(
      `  ✓ ${organization.name} (${objects.length} elemento(s) revisado(s))`,
    );
  }

  console.log(`\nCasados: ${matched}. Sem match: ${skipped}.`);
  if (orphans.size > 0) {
    console.log("\nValores de category sem StoreSector correspondente:");
    for (const [category, count] of [...orphans.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(`  "${category}" — ${count} elemento(s)`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
