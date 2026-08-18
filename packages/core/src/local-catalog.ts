import type { LocalProduct, SyncCursor } from "./types";

/**
 * Catálogo local do device — a interface que o resto do `@nerp/core` usa, sem
 * saber se por baixo é IndexedDB (web/PWA) ou SQLite (Tauri nativo).
 *
 * É o ÚNICO ponto de troca de storage: `sync.ts` e o PDV falam só com isto.
 */
export interface LocalCatalog {
  /** Grava/atualiza produtos (idempotente por id). */
  upsertProducts(products: LocalProduct[]): Promise<void>;

  /** Busca por nome/sku/código (case-insensitive), só ativos, limitada. */
  searchProducts(term: string, limit?: number): Promise<LocalProduct[]>;

  /** Quantos produtos há em cache (para saber se já sincronizou alguma vez). */
  count(): Promise<number>;

  /** Cursor persistido do último sync (watermark). null = nunca sincronizou. */
  getCursor(): Promise<SyncCursor | null>;
  setCursor(cursor: SyncCursor): Promise<void>;

  /** ISO do último sync bem-sucedido (para exibir "sincronizado há…"). */
  getLastSyncedAt(): Promise<string | null>;
  setLastSyncedAt(iso: string): Promise<void>;
}
