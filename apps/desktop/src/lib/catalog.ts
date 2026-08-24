import { type LocalCatalog, syncCatalog, type SyncResult } from "@nerp/core";
import { client } from "./client";
import { isNative } from "./platform";

/**
 * Catálogo local do device.
 *
 * Os dois adapters entram por import dinâmico de subpath: SQLite
 * (`@nerp/core/sqlite`) no Tauri, IndexedDB (`@nerp/core/indexeddb`) no
 * navegador. Nenhum dos dois está no barrel, então cada bundle carrega só a
 * dependência de plataforma que usa.
 */
let catalogPromise: Promise<LocalCatalog> | null = null;

export function getCatalog(): Promise<LocalCatalog> {
  catalogPromise ??= (async () => {
    if (isNative()) {
      const { createSqliteCatalog } = await import("@nerp/core/sqlite");
      return createSqliteCatalog();
    }
    const { createIndexedDbCatalog } = await import("@nerp/core/indexeddb");
    return createIndexedDbCatalog();
  })();
  return catalogPromise;
}

/** Dispara uma rodada de sync do catálogo, ligando o pull ao cliente oRPC. */
export async function syncNow(): Promise<SyncResult> {
  const catalog = await getCatalog();
  return syncCatalog(catalog, (input) => client.products.pull(input));
}
