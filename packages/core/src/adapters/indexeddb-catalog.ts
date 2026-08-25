import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { LocalCatalog } from "../local-catalog";
import type { LocalProduct, SyncCursor } from "../types";

/**
 * Adapter de catálogo local em IndexedDB — o storage do device na WEB/PWA e no
 * dev (é onde a Fase 2 é verificada). No Tauri nativo o storage é SQLite (ver
 * `sqlite-catalog.ts`); os dois implementam a mesma `LocalCatalog`.
 *
 * A busca é feita em memória (getAll + filtro): IndexedDB não tem full-text, e
 * para um catálogo de loja isso é barato. Se um dia ficar grande, migra para
 * índices/paginated cursor.
 */
interface CatalogSchema extends DBSchema {
  products: { key: string; value: LocalProduct };
  meta: { key: string; value: string };
}

const STORE_PRODUCTS = "products";
const STORE_META = "meta";
const KEY_CURSOR = "cursor";
const KEY_LAST_SYNCED = "lastSyncedAt";

export function createIndexedDbCatalog(dbName = "nerp-catalog"): LocalCatalog {
  let dbPromise: Promise<IDBPDatabase<CatalogSchema>> | null = null;

  const db = () => {
    dbPromise ??= openDB<CatalogSchema>(dbName, 1, {
      upgrade(database) {
        database.createObjectStore(STORE_PRODUCTS, { keyPath: "id" });
        database.createObjectStore(STORE_META);
      },
    });
    return dbPromise;
  };

  return {
    async upsertProducts(products: LocalProduct[]) {
      const database = await db();
      const tx = database.transaction(STORE_PRODUCTS, "readwrite");
      await Promise.all(products.map((product) => tx.store.put(product)));
      await tx.done;
    },

    async searchProducts(term: string, limit = 50) {
      const database = await db();
      const all = await database.getAll(STORE_PRODUCTS);
      const needle = term.trim().toLowerCase();
      const matches = all.filter((product) => {
        if (!product.isActive) return false;
        if (!needle) return true;
        return (
          product.name.toLowerCase().includes(needle) ||
          product.sku.toLowerCase().includes(needle) ||
          product.barcode.toLowerCase().includes(needle)
        );
      });
      matches.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      return matches.slice(0, limit);
    },

    async count() {
      const database = await db();
      return database.count(STORE_PRODUCTS);
    },

    async getCursor() {
      const database = await db();
      const raw = await database.get(STORE_META, KEY_CURSOR);
      return raw ? (JSON.parse(raw) as SyncCursor) : null;
    },
    async setCursor(cursor: SyncCursor) {
      const database = await db();
      await database.put(STORE_META, JSON.stringify(cursor), KEY_CURSOR);
    },

    async getLastSyncedAt() {
      const database = await db();
      return (await database.get(STORE_META, KEY_LAST_SYNCED)) ?? null;
    },
    async setLastSyncedAt(iso: string) {
      const database = await db();
      await database.put(STORE_META, iso, KEY_LAST_SYNCED);
    },
  };
}
