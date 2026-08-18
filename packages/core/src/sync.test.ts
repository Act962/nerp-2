import { describe, expect, it } from "vitest";
import type { LocalCatalog } from "./local-catalog";
import { syncCatalog } from "./sync";
import type { CatalogPage, LocalProduct, SyncCursor } from "./types";

// Catálogo fake em memória — implementa a interface para testar o orquestrador
// sem IndexedDB/SQLite.
function fakeCatalog() {
  const products = new Map<string, LocalProduct>();
  let cursor: SyncCursor | null = null;
  let lastSyncedAt: string | null = null;
  const store: LocalCatalog = {
    async upsertProducts(list) {
      for (const p of list) products.set(p.id, p);
    },
    async searchProducts() {
      return [...products.values()];
    },
    async count() {
      return products.size;
    },
    async getCursor() {
      return cursor;
    },
    async setCursor(c) {
      cursor = c;
    },
    async getLastSyncedAt() {
      return lastSyncedAt;
    },
    async setLastSyncedAt(iso) {
      lastSyncedAt = iso;
    },
  };
  return { store, products, getCursor: () => cursor };
}

const prod = (id: string, updatedAt: string): LocalProduct => ({
  id,
  name: `Produto ${id}`,
  sku: id,
  barcode: "",
  salePrice: 1,
  currentStock: 0,
  unit: "UN",
  isActive: true,
  updatedAt,
});

describe("syncCatalog", () => {
  it("puxa todas as páginas e persiste o watermark", async () => {
    const { store, products, getCursor } = fakeCatalog();
    // 3 páginas: server responde conforme o cursor recebido.
    const pages: CatalogPage[] = [
      {
        products: [prod("a", "2026-01-01T00:00:00Z")],
        cursor: { updatedAt: "2026-01-01T00:00:00Z", id: "a" },
        hasMore: true,
      },
      {
        products: [prod("b", "2026-01-02T00:00:00Z")],
        cursor: { updatedAt: "2026-01-02T00:00:00Z", id: "b" },
        hasMore: true,
      },
      {
        products: [prod("c", "2026-01-03T00:00:00Z")],
        cursor: { updatedAt: "2026-01-03T00:00:00Z", id: "c" },
        hasMore: false,
      },
    ];
    let call = 0;
    const result = await syncCatalog(
      store,
      async () => pages[call++],
      () => "2026-01-03T10:00:00Z",
    );

    expect(result.pulled).toBe(3);
    expect(products.size).toBe(3);
    expect(getCursor()).toEqual({ updatedAt: "2026-01-03T00:00:00Z", id: "c" });
    expect(result.syncedAt).toBe("2026-01-03T10:00:00Z");
  });

  it("resume do cursor persistido e traz só o incremental", async () => {
    const { store, getCursor } = fakeCatalog();
    await store.setCursor({ updatedAt: "2026-01-03T00:00:00Z", id: "c" });

    const seen: Array<string | null> = [];
    await syncCatalog(store, async (input) => {
      seen.push(input.updatedAt);
      return {
        products: [prod("d", "2026-01-04T00:00:00Z")],
        cursor: { updatedAt: "2026-01-04T00:00:00Z", id: "d" },
        hasMore: false,
      };
    });

    // Começou do watermark salvo, não do zero.
    expect(seen[0]).toBe("2026-01-03T00:00:00Z");
    expect(getCursor()).toEqual({ updatedAt: "2026-01-04T00:00:00Z", id: "d" });
  });

  it("página vazia não quebra e não mexe no cursor", async () => {
    const { store, getCursor } = fakeCatalog();
    const result = await syncCatalog(store, async () => ({
      products: [],
      cursor: null,
      hasMore: false,
    }));
    expect(result.pulled).toBe(0);
    expect(getCursor()).toBeNull();
  });
});
