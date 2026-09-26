import { S2S_ESCOPO_TOTAL } from "@/lib/s2s-scopes";

/** Escopo que autoriza o NERP a empurrar pedidos do Catálogo ao Órbita. */
export const CATALOG_ORDERS_PUSH_SCOPE = "catalog-orders:push";

export function canPushCatalogOrders(scopes: readonly string[]): boolean {
  return (
    scopes.includes(CATALOG_ORDERS_PUSH_SCOPE) ||
    scopes.includes(S2S_ESCOPO_TOTAL)
  );
}
