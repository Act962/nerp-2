import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Espelha NEGOTIABLE_TYPES de features/store-map/engine/space-state.ts. Inline
// aqui para o router não acoplar módulos do engine do mapa. "Espaço" = objeto
// negociável: tipo comercial OU com mídia atribuída.
const NEGOTIABLE_TYPES: Prisma.MapObjectWhereInput["type"] = {
  in: ["GONDOLA", "ISLAND", "CHECKOUT", "PIN"],
};
const NEGOTIABLE_WHERE: Prisma.MapObjectWhereInput = {
  OR: [{ type: NEGOTIABLE_TYPES }, { mediaTypeId: { not: null } }],
};

export interface GroupStats {
  pdvs: number;
  checkouts: number;
  industrias: number;
  espacos: number;
}

export async function loadGroupStats(
  organizationId: string,
): Promise<GroupStats> {
  const [pdvs, checkouts, industrias, espacos] = await Promise.all([
    prisma.store.count({ where: { organizationId, isActive: true } }),
    prisma.mapObject.count({ where: { organizationId, type: "CHECKOUT" } }),
    prisma.supplier.count({ where: { organizationId } }),
    prisma.mapObject.count({ where: { organizationId, ...NEGOTIABLE_WHERE } }),
  ]);
  return { pdvs, checkouts, industrias, espacos };
}

export interface StoreTileStats {
  espacos: number;
  negociados: number;
}

// Uma query agrupa os espaços por loja em memória, evitando 2×N counts quando o
// grupo tem muitas unidades. MapObject liga à loja por floorPlan.storeId.
export async function loadPerStoreStats(
  organizationId: string,
): Promise<Map<string, StoreTileStats>> {
  const objects = await prisma.mapObject.findMany({
    where: { organizationId, ...NEGOTIABLE_WHERE },
    select: { spaceState: true, floorPlan: { select: { storeId: true } } },
  });

  const byStore = new Map<string, StoreTileStats>();
  for (const object of objects) {
    const storeId = object.floorPlan.storeId;
    const entry = byStore.get(storeId) ?? { espacos: 0, negociados: 0 };
    entry.espacos += 1;
    if (object.spaceState === "EXECUTADO") entry.negociados += 1;
    byStore.set(storeId, entry);
  }
  return byStore;
}

export { NEGOTIABLE_WHERE };
