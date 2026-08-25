/**
 * Reclassifica pricingBasis dos MediaType padrão já semeados (isSystemDefault)
 * para orgs que rodaram o seed antes do campo existir. Uso:
 * pnpm dlx tsx scripts/backfill-media-pricing-basis.ts
 *
 * Só toca isSystemDefault=true — mídias já customizadas pela org não são
 * mexidas. Idempotente: reatribuir o mesmo valor não muda nada.
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_MEDIA_TYPES } from "../src/features/trade-catalog/lib/defaults";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const flatCodes = DEFAULT_MEDIA_TYPES.filter(
    (media) => media.pricingBasis === "FLAT",
  ).map((media) => media.code);

  const result = await prisma.mediaType.updateMany({
    where: { code: { in: flatCodes }, isSystemDefault: true },
    data: { pricingBasis: "FLAT" },
  });

  console.log(`Reclassificados ${result.count} MediaType(s) padrão como FLAT.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
