import type { LocalCatalog } from "./local-catalog";
import type { CatalogPull, SyncResult } from "./types";

const PAGE_LIMIT = 500;
/** Trava de segurança: nunca mais que isto de páginas numa rodada. */
const MAX_PAGES = 1000;

/**
 * Sincroniza o catálogo (server → local), incremental.
 *
 * Retoma do cursor persistido (watermark) e puxa em páginas até o server dizer
 * que não há mais. Upsert idempotente, então reprocessar a borda não duplica.
 * O cursor é persistido a CADA página — se cair no meio, a próxima rodada
 * continua de onde parou, sem recomeçar do zero.
 *
 * Não recebe o cliente oRPC direto: o host injeta `pull` (ligado em
 * `client.products.pull`). Assim `@nerp/core` não depende de `@nerp/api`.
 */
export async function syncCatalog(
  catalog: LocalCatalog,
  pull: CatalogPull,
  now: () => string = () => new Date().toISOString(),
): Promise<SyncResult> {
  let cursor = await catalog.getCursor();
  let pulled = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await pull({
      updatedAt: cursor?.updatedAt ?? null,
      id: cursor?.id ?? null,
      limit: PAGE_LIMIT,
    });

    if (result.products.length > 0) {
      await catalog.upsertProducts(result.products);
      pulled += result.products.length;
    }
    if (result.cursor) {
      cursor = result.cursor;
      await catalog.setCursor(cursor);
    }
    if (!result.hasMore) break;
  }

  const syncedAt = now();
  await catalog.setLastSyncedAt(syncedAt);
  return { pulled, cursor, syncedAt };
}
