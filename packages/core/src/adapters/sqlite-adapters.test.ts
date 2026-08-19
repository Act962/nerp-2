import { describe, expect, it, vi } from "vitest";
import { drainOutbox } from "../outbox";
import type { LocalProduct } from "../types";

/**
 * Prova de que o SQL cru dos adapters nativos está correto: mocka o
 * `@tauri-apps/plugin-sql` por um fake apoiado no `node:sqlite` (SQLite de
 * verdade, embutido no Node), então as mesmas queries que rodariam no device
 * são exercitadas aqui — o caminho nativo que até a Fase 4 só existia no papel.
 *
 * O fake replica o contrato do plugin: `Database.load(path)` (conexão por path,
 * compartilhada quando o path coincide, como no device), `execute` (DDL sem
 * params via `exec`; escrita parametrizada via `prepare().run`) e `select`. Os
 * placeholders `$1,$2…` do SQLite são ligados por objeto nomeado ({"1":…}).
 */
vi.mock("@tauri-apps/plugin-sql", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const pool = new Map<string, InstanceType<typeof DatabaseSync>>();

  const named = (params?: unknown[]): Record<string, unknown> => {
    const obj: Record<string, unknown> = {};
    (params ?? []).forEach((v, i) => {
      obj[String(i + 1)] = v === undefined ? null : v;
    });
    return obj;
  };

  class FakeDatabase {
    private db: InstanceType<typeof DatabaseSync>;
    private constructor(path: string) {
      let db = pool.get(path);
      if (!db) {
        db = new DatabaseSync(":memory:");
        pool.set(path, db);
      }
      this.db = db;
    }
    static async load(path: string): Promise<FakeDatabase> {
      return new FakeDatabase(path);
    }
    async execute(sql: string, params?: unknown[]) {
      if (params?.length) this.db.prepare(sql).run(named(params));
      else this.db.exec(sql); // DDL pode ter múltiplos statements
      return { rowsAffected: 0, lastInsertId: 0 };
    }
    async select<T>(sql: string, params?: unknown[]): Promise<T> {
      const stmt = this.db.prepare(sql);
      return (params?.length ? stmt.all(named(params)) : stmt.all()) as T;
    }
  }
  return { default: FakeDatabase };
});

// Importados DEPOIS do mock (os adapters fazem `import Database from …`).
const { createSqliteCatalog } = await import("./sqlite-catalog");
const { createSqliteOutbox } = await import("./sqlite-outbox");

const prod = (over: Partial<LocalProduct> & { id: string }): LocalProduct => ({
  name: over.id,
  sku: `sku-${over.id}`,
  barcode: `bar-${over.id}`,
  salePrice: 10,
  currentStock: 5,
  unit: "un",
  isActive: true,
  updatedAt: "2026-01-01T00:00:00Z",
  ...over,
});

describe("createSqliteCatalog (SQLite real via node:sqlite)", () => {
  it("upsert, busca, contagem, cursor e watermark", async () => {
    const cat = await createSqliteCatalog("sqlite:cat-1.db");

    await cat.upsertProducts([
      prod({ id: "a", name: "Arroz", sku: "SKU-A", barcode: "789A" }),
      prod({ id: "b", name: "Banana", sku: "SKU-B", barcode: "789B" }),
    ]);

    expect(await cat.count()).toBe(2);

    // Ordenado por nome, ambos ativos.
    const all = await cat.searchProducts("");
    expect(all.map((p) => p.id)).toEqual(["a", "b"]);
    // isActive volta como boolean (SQLite guarda 1/0).
    expect(all[0].isActive).toBe(true);

    // Busca por nome, SKU e código de barras (case-insensitive).
    expect((await cat.searchProducts("arr")).map((p) => p.id)).toEqual(["a"]);
    expect((await cat.searchProducts("sku-b")).map((p) => p.id)).toEqual(["b"]);
    expect((await cat.searchProducts("789a")).map((p) => p.id)).toEqual(["a"]);

    // Upsert do mesmo id ATUALIZA, não duplica.
    await cat.upsertProducts([
      prod({ id: "a", name: "Arroz Novo", salePrice: 12 }),
    ]);
    expect(await cat.count()).toBe(2);
    const a = (await cat.searchProducts("arroz novo"))[0];
    expect(a.salePrice).toBe(12);

    // Inativo some da busca (mas continua no count).
    await cat.upsertProducts([
      prod({ id: "a", name: "Arroz Novo", isActive: false }),
    ]);
    expect((await cat.searchProducts("arroz")).map((p) => p.id)).toEqual([]);
    expect(await cat.count()).toBe(2);

    // Cursor e lastSyncedAt persistem (tabela meta).
    expect(await cat.getCursor()).toBeNull();
    await cat.setCursor({ updatedAt: "2026-01-02T00:00:00Z", id: "b" });
    expect(await cat.getCursor()).toEqual({
      updatedAt: "2026-01-02T00:00:00Z",
      id: "b",
    });
    await cat.setLastSyncedAt("2026-01-02T10:00:00Z");
    expect(await cat.getLastSyncedAt()).toBe("2026-01-02T10:00:00Z");
  });
});

describe("createSqliteOutbox (SQLite real via node:sqlite)", () => {
  it("enqueue, pending, update e dead-letter", async () => {
    const box = await createSqliteOutbox("sqlite:box-1.db");

    await box.enqueue({
      id: "op-1",
      type: "sale.create",
      payload: { total: 9 },
    });
    await box.enqueue({
      id: "op-2",
      type: "sale.create",
      payload: { total: 5 },
    });

    expect(await box.countPending()).toBe(2);
    const pend = await box.pending();
    expect(pend.map((i) => i.id)).toEqual(["op-1", "op-2"]);
    // payload volta desserializado.
    expect(pend[0].payload).toEqual({ total: 9 });

    // Sucesso: marca done com resultado.
    await box.update("op-1", { status: "done", result: { saleNumber: 42 } });
    expect(await box.countPending()).toBe(1);

    // Falha persistente: vira dead-letter, sai de pending, entra em failed.
    await box.update("op-2", {
      status: "failed",
      attempts: 5,
      lastError: "produto removido",
    });
    expect(await box.countPending()).toBe(0);
    const dead = await box.failed();
    expect(dead).toHaveLength(1);
    expect(dead[0].id).toBe("op-2");
    expect(dead[0].lastError).toBe("produto removido");
  });

  it("drainOutbox replica em ordem e persiste o resultado (sucesso)", async () => {
    const box = await createSqliteOutbox("sqlite:box-2.db");
    await box.enqueue({ id: "s1", type: "sale.create", payload: { total: 1 } });
    await box.enqueue({ id: "s2", type: "sale.create", payload: { total: 2 } });

    const seen: string[] = [];
    const res = await drainOutbox(box, async (item) => {
      seen.push(item.id);
      return { saleNumber: seen.length };
    });

    expect(seen).toEqual(["s1", "s2"]); // FIFO
    expect(res).toEqual({ synced: 2, failed: 0, remaining: 0 });
    expect(await box.countPending()).toBe(0);
  });

  it("drainOutbox manda para dead-letter após esgotar tentativas", async () => {
    const box = await createSqliteOutbox("sqlite:box-3.db");
    await box.enqueue({
      id: "bad",
      type: "sale.create",
      payload: { total: 7 },
    });

    // Cada drain com replay que sempre falha bump +1; 5 rodadas → failed.
    for (let i = 0; i < 5; i++) {
      await drainOutbox(box, async () => {
        throw new Error("500 do server");
      });
    }

    expect(await box.countPending()).toBe(0);
    const dead = await box.failed();
    expect(dead).toHaveLength(1);
    expect(dead[0].attempts).toBe(5);
    expect(dead[0].lastError).toContain("500");
  });
});
