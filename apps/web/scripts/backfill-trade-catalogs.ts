/**
 * Backfill dos catálogos padrão do Trade para orgs já existentes.
 * Uso: pnpm dlx tsx scripts/backfill-trade-catalogs.ts
 *
 * Idempotente: o `@@unique([organizationId, code])` + `skipDuplicates` fazem
 * re-execuções serem no-op e orgs criadas após a migração (já semeadas pelo
 * afterCreateOrganization) não ganham duplicatas.
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  DEFAULT_MEDIA_TYPES,
  DEFAULT_NEGOTIATION_TYPES,
  DEFAULT_STORE_SECTORS,
} from "../src/features/trade-catalog/lib/defaults";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
  });
  console.log(`Backfilling ${organizations.length} organização(ões)...`);

  for (const organization of organizations) {
    await prisma.mediaType.createMany({
      data: DEFAULT_MEDIA_TYPES.map((media, index) => ({
        organizationId: organization.id,
        kind: media.kind,
        code: media.code,
        name: media.name,
        pricingBasis: media.pricingBasis ?? "AREA",
        sortOrder: index,
        isSystemDefault: true,
      })),
      skipDuplicates: true,
    });
    await prisma.negotiationType.createMany({
      data: DEFAULT_NEGOTIATION_TYPES.map((negotiation, index) => ({
        organizationId: organization.id,
        code: negotiation.code,
        name: negotiation.name,
        sortOrder: index,
        isSystemDefault: true,
      })),
      skipDuplicates: true,
    });
    await prisma.storeSector.createMany({
      data: DEFAULT_STORE_SECTORS.map((sector, index) => ({
        organizationId: organization.id,
        code: sector.code,
        name: sector.name,
        sortOrder: index,
        isSystemDefault: true,
      })),
      skipDuplicates: true,
    });
    console.log(`  ✓ ${organization.name}`);
  }

  console.log("Concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
