import "server-only";

import prisma from "@/lib/db";
import {
  DEFAULT_MEDIA_TYPES,
  DEFAULT_NEGOTIATION_TYPES,
  DEFAULT_STORE_SECTORS,
} from "./defaults";

type PrismaLike = typeof prisma;

export type EnsureTradeCatalogsResult = {
  mediaTypes: number;
  negotiationTypes: number;
  storeSectors: number;
  total: number;
};

// Semeia os catálogos padrão do Trade numa org. Idempotente: o
// `@@unique([organizationId, code])` + `skipDuplicates` fazem re-execuções serem
// no-op, então serve tanto ao hook de criação quanto ao backfill. Retorna quantos
// itens foram efetivamente inseridos (0 em cada quando já estava tudo semeado).
export async function ensureTradeCatalogs(
  organizationId: string,
  client: PrismaLike = prisma,
): Promise<EnsureTradeCatalogsResult> {
  const media = await client.mediaType.createMany({
    data: DEFAULT_MEDIA_TYPES.map((media, index) => ({
      organizationId,
      kind: media.kind,
      code: media.code,
      name: media.name,
      pricingBasis: media.pricingBasis ?? "AREA",
      sortOrder: index,
      isSystemDefault: true,
    })),
    skipDuplicates: true,
  });

  const negotiation = await client.negotiationType.createMany({
    data: DEFAULT_NEGOTIATION_TYPES.map((negotiation, index) => ({
      organizationId,
      code: negotiation.code,
      name: negotiation.name,
      sortOrder: index,
      isSystemDefault: true,
    })),
    skipDuplicates: true,
  });

  const sector = await client.storeSector.createMany({
    data: DEFAULT_STORE_SECTORS.map((sector, index) => ({
      organizationId,
      code: sector.code,
      name: sector.name,
      sortOrder: index,
      isSystemDefault: true,
    })),
    skipDuplicates: true,
  });

  return {
    mediaTypes: media.count,
    negotiationTypes: negotiation.count,
    storeSectors: sector.count,
    total: media.count + negotiation.count + sector.count,
  };
}
