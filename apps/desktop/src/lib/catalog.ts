import {
  createIndexedDbCatalog,
  type LocalCatalog,
  syncCatalog,
  type SyncResult,
} from "@nerp/core";
import { client } from "./client";

/**
 * Catálogo local do device.
 *
 * No Tauri usa SQLite (`@nerp/core/sqlite`), carregado por import dinâmico só
 * quando `window.__TAURI__` existe — assim o `@tauri-apps/plugin-sql` NÃO entra
 * no bundle web. No navegador/dev usa IndexedDB.
 */
let catalogPromise: Promise<LocalCatalog> | null = null;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export function getCatalog(): Promise<LocalCatalog> {
  catalogPromise ??= (async () => {
    if (isTauri()) {
      const { createSqliteCatalog } = await import("@nerp/core/sqlite");
      return createSqliteCatalog();
    }
    return createIndexedDbCatalog();
  })();
  return catalogPromise;
}

/** Dispara uma rodada de sync do catálogo, ligando o pull ao cliente oRPC. */
export async function syncNow(): Promise<SyncResult> {
  const catalog = await getCatalog();
  return syncCatalog(catalog, (input) => client.products.pull(input));
}
