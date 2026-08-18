import Database from "@tauri-apps/plugin-sql";
import type { LocalCatalog } from "../local-catalog";
import type { LocalProduct, SyncCursor } from "../types";

/**
 * Adapter de catálogo local em SQLite via `@tauri-apps/plugin-sql` — o storage
 * do device no app NATIVO (Tauri). Implementa a mesma `LocalCatalog` do adapter
 * IndexedDB, então `sync.ts` e o PDV não sabem qual está por baixo.
 *
 * ⚠️ Só roda dentro do Tauri (precisa do plugin nativo). Não é exercitável no
 * navegador — por isso a Fase 2 é verificada pelo adapter IndexedDB. Para ligar
 * no nativo, ver os passos no README do desktop (Cargo + capability + conf).
 *
 * SQL cru parametrizado (não Drizzle): para uma tabela de catálogo é mais
 * simples e sem dependência extra; dá para colocar Drizzle por cima depois.
 */
const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT NOT NULL,
  salePrice REAL NOT NULL,
  currentStock REAL NOT NULL,
  unit TEXT NOT NULL,
  isActive INTEGER NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

type ProductRow = Omit<LocalProduct, "isActive"> & { isActive: number };

export async function createSqliteCatalog(
  path = "sqlite:nerp-catalog.db",
): Promise<LocalCatalog> {
  const db = await Database.load(path);
  await db.execute(CREATE_SQL);

  const meta = {
    async get(key: string): Promise<string | null> {
      const rows = await db.select<{ value: string }[]>(
        "SELECT value FROM meta WHERE key = $1",
        [key],
      );
      return rows[0]?.value ?? null;
    },
    async set(key: string, value: string): Promise<void> {
      await db.execute(
        "INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
        [key, value],
      );
    },
  };

  return {
    async upsertProducts(products: LocalProduct[]) {
      for (const p of products) {
        await db.execute(
          `INSERT INTO products (id, name, sku, barcode, salePrice, currentStock, unit, isActive, updatedAt)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT(id) DO UPDATE SET
             name=$2, sku=$3, barcode=$4, salePrice=$5, currentStock=$6, unit=$7, isActive=$8, updatedAt=$9`,
          [
            p.id,
            p.name,
            p.sku,
            p.barcode,
            p.salePrice,
            p.currentStock,
            p.unit,
            p.isActive ? 1 : 0,
            p.updatedAt,
          ],
        );
      }
    },

    async searchProducts(term: string, limit = 50) {
      const like = `%${term.trim().toLowerCase()}%`;
      const rows = await db.select<ProductRow[]>(
        `SELECT * FROM products
         WHERE isActive = 1
           AND (lower(name) LIKE $1 OR lower(sku) LIKE $1 OR lower(barcode) LIKE $1)
         ORDER BY name ASC LIMIT $2`,
        [like, limit],
      );
      return rows.map((row) => ({ ...row, isActive: row.isActive === 1 }));
    },

    async count() {
      const rows = await db.select<{ n: number }[]>(
        "SELECT COUNT(*) as n FROM products",
      );
      return rows[0]?.n ?? 0;
    },

    async getCursor() {
      const raw = await meta.get("cursor");
      return raw ? (JSON.parse(raw) as SyncCursor) : null;
    },
    async setCursor(cursor: SyncCursor) {
      await meta.set("cursor", JSON.stringify(cursor));
    },

    async getLastSyncedAt() {
      return meta.get("lastSyncedAt");
    },
    async setLastSyncedAt(iso: string) {
      await meta.set("lastSyncedAt", iso);
    },
  };
}
