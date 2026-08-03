import prisma from "@/lib/db";
import { storePublicPath } from "@/lib/store-slug";

/**
 * A "face pública" de um ponto do OpenStreetMap.
 *
 * Um `DirectoryStore` é global e não tem organização — mas "Mapa da loja",
 * "App QR Preço" e "TradeGram" precisam de um `Store` concreto numa empresa com
 * perfil público. A ponte entre os dois é o `osmId`.
 */
export interface PublicFace {
  /** URL da página pública, já montada. O cliente não conhece o formato. */
  path: string;
  /** Tem planta com objetos — planta vazia renderiza tela em branco. */
  hasFloorPlan: boolean;
  /** A empresa tem produto ativo com código de barras para o scanner achar. */
  hasPriceScan: boolean;
}

interface Candidate {
  storeId: string;
  osmId: string;
  orgSlug: string;
  slug: string | null;
  organizationId: string;
  createdAt: Date;
}

/**
 * Resolve várias de uma vez — custo constante, não por ponto.
 *
 * Duas regras que não são detalhe:
 *
 * 1. **Devolve UMA face por ponto, nunca uma lista.** Uma lista contaria a cada
 *    inquilino que outras empresas têm aquele supermercado como cliente — o
 *    vazamento de carteira mais direto que este modelo permite.
 * 2. **Não recebe nem consulta a organização de quem chamou.** O resultado é uma
 *    URL pública; seria incoerente dois usuários verem links públicos diferentes
 *    para o mesmo ponto. É também o que permite reusar isto sem autenticação.
 */
export async function resolvePublicFaces(
  osmIds: string[],
): Promise<Map<string, PublicFace>> {
  const faces = new Map<string, PublicFace>();
  const wanted = osmIds.filter((id) => id.length > 0);
  if (wanted.length === 0) return faces;

  const stores = await prisma.store.findMany({
    where: {
      osmId: { in: wanted },
      isActive: true,
      organization: { isPublicProfile: true },
    },
    select: {
      id: true,
      osmId: true,
      slug: true,
      organizationId: true,
      createdAt: true,
      organization: { select: { slug: true } },
    },
  });
  if (stores.length === 0) return faces;

  const candidates: Candidate[] = [];
  for (const store of stores) {
    // `osmId` é anulável no schema mas o `where` acima garante que veio; o
    // predicado existe porque o TypeScript não estreita por `in`.
    if (!store.osmId || !store.organization.slug) continue;
    candidates.push({
      storeId: store.id,
      osmId: store.osmId,
      slug: store.slug,
      orgSlug: store.organization.slug,
      organizationId: store.organizationId,
      createdAt: store.createdAt,
    });
  }
  if (candidates.length === 0) return faces;

  const storeIds = candidates.map((c) => c.storeId);
  const orgIds = [...new Set(candidates.map((c) => c.organizationId))];

  const [claims, plans, orgsWithBarcode] = await Promise.all([
    // Quem reivindicou a rede é o dono da bandeira — o desempate mais legítimo
    // disponível, e o mecanismo já existe (`CompanyClaim`).
    prisma.directoryStore.findMany({
      where: { osmId: { in: wanted } },
      select: { osmId: true, company: { select: { claimedByOrgId: true } } },
    }),
    prisma.floorPlan.findMany({
      where: { storeId: { in: storeIds } },
      select: { storeId: true, _count: { select: { objects: true } } },
    }),
    prisma.product.findMany({
      where: {
        organizationId: { in: orgIds },
        isActive: true,
        barcode: { not: null },
      },
      distinct: ["organizationId"],
      select: { organizationId: true },
    }),
  ]);

  const claimedBy = new Map<string, string>();
  for (const claim of claims) {
    if (claim.osmId && claim.company?.claimedByOrgId) {
      claimedBy.set(claim.osmId, claim.company.claimedByOrgId);
    }
  }

  const withPlan = new Set(
    plans.filter((p) => p._count.objects > 0).map((p) => p.storeId),
  );
  const withBarcode = new Set(orgsWithBarcode.map((o) => o.organizationId));

  const byOsm = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const list = byOsm.get(candidate.osmId);
    if (list) list.push(candidate);
    else byOsm.set(candidate.osmId, [candidate]);
  }

  for (const [osmId, list] of byOsm) {
    const claimed = claimedBy.get(osmId);
    const winner = [...list].sort((a, b) => {
      const aClaimed = a.organizationId === claimed ? 0 : 1;
      const bClaimed = b.organizationId === claimed ? 0 : 1;
      if (aClaimed !== bClaimed) return aClaimed - bClaimed;

      const aPlan = withPlan.has(a.storeId) ? 0 : 1;
      const bPlan = withPlan.has(b.storeId) ? 0 : 1;
      if (aPlan !== bPlan) return aPlan - bPlan;

      // Determinístico até o fim: sem isto a face mudaria entre requisições.
      return a.createdAt.getTime() - b.createdAt.getTime();
    })[0];

    if (!winner) continue;

    faces.set(osmId, {
      path: storePublicPath(winner.orgSlug, winner.storeId, winner.slug),
      hasFloorPlan: withPlan.has(winner.storeId),
      hasPriceScan: withBarcode.has(winner.organizationId),
    });
  }

  return faces;
}
