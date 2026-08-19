import { describe, expect, it } from "vitest";
import { drainOutbox, type Outbox } from "./outbox";
import type { OutboxItem } from "./types";

// Outbox fake em memória para testar o orquestrador de drain. A ordem de
// iteração do Map = ordem de enqueue = FIFO (como os adapters, que ordenam por
// createdAt).
function fakeOutbox(seed: OutboxItem[] = []) {
  const items = new Map(seed.map((i) => [i.id, { ...i }]));
  const store: Outbox = {
    async enqueue(op) {
      items.set(op.id, {
        id: op.id,
        type: op.type,
        payload: op.payload,
        status: "pending",
        attempts: 0,
        createdAt: new Date().toISOString(),
      });
    },
    async pending() {
      return [...items.values()].filter((i) => i.status === "pending");
    },
    async failed() {
      return [...items.values()].filter((i) => i.status === "failed");
    },
    async update(id, patch) {
      const cur = items.get(id);
      if (cur) items.set(id, { ...cur, ...patch });
    },
    async countPending() {
      return [...items.values()].filter((i) => i.status === "pending").length;
    },
  };
  return { store, items };
}

const item = (id: string): OutboxItem => ({
  id,
  type: "sale.create",
  payload: { total: 10 },
  status: "pending",
  attempts: 0,
  createdAt: `2026-01-01T00:00:0${id}Z`,
});

const op = (id: string, type: string): OutboxItem => ({
  id,
  type,
  payload: {},
  status: "pending",
  attempts: 0,
  createdAt: `2026-01-01T00:00:0${id}Z`,
});

describe("drainOutbox", () => {
  it("replica todas as pendentes e marca done com o resultado", async () => {
    const { store, items } = fakeOutbox([item("1"), item("2")]);
    const result = await drainOutbox(store, async (it) => ({
      saleNumber: Number(it.id) + 100,
    }));

    expect(result.synced).toBe(2);
    expect(result.remaining).toBe(0);
    expect(items.get("1")?.status).toBe("done");
    expect(items.get("1")?.result).toEqual({ saleNumber: 101 });
  });

  it("falha transitória: mantém pending, incrementa attempts e para", async () => {
    const { store, items } = fakeOutbox([item("1"), item("2")]);
    const result = await drainOutbox(store, async () => {
      throw new Error("fetch failed");
    });

    expect(result.synced).toBe(0);
    expect(items.get("1")?.status).toBe("pending");
    expect(items.get("1")?.attempts).toBe(1);
    // parou na primeira: a segunda nem foi tentada.
    expect(items.get("2")?.attempts).toBe(0);
  });

  it("dead-letter após esgotar as tentativas PARA a fila (não pula)", async () => {
    const almost: OutboxItem = { ...item("1"), attempts: 4 };
    const { store, items } = fakeOutbox([almost, item("2")]);
    const result = await drainOutbox(store, async (it) => {
      if (it.id === "1") throw new Error("produto sumiu");
      return { saleNumber: 200 };
    });

    expect(items.get("1")?.status).toBe("failed"); // dead-letter (5ª tentativa)
    expect(result.failed).toBe(1);
    // Estritamente em ordem: a segunda NÃO é processada (fica pendente).
    expect(items.get("2")?.status).toBe("pending");
    expect(result.synced).toBe(0);
  });
});

// Ordenação causal — a cadeia de uma sessão de caixa não pode reordenar.
describe("drainOutbox — ordenação causal (caixa)", () => {
  const sessionOps = () => [
    op("1", "cashSession.open"),
    op("2", "sale.create"),
    op("3", "cash.sangria"),
    op("4", "cashSession.close"),
  ];

  it("1) FIFO normal: replaya OPEN→VENDA→SANGRIA→CLOSE nessa ordem", async () => {
    const { store } = fakeOutbox(sessionOps());
    const seen: string[] = [];
    const res = await drainOutbox(store, async (it) => {
      seen.push(it.type);
      return {};
    });
    expect(seen).toEqual([
      "cashSession.open",
      "sale.create",
      "cash.sangria",
      "cashSession.close",
    ]);
    expect(res.synced).toBe(4);
  });

  it("2) predecessor pendente (falha transitória) bloqueia os sucessores", async () => {
    const { store, items } = fakeOutbox(sessionOps());
    const seen: string[] = [];
    await drainOutbox(store, async (it) => {
      seen.push(it.type);
      if (it.type === "sale.create") throw new Error("rede caiu");
      return {};
    });
    // Parou na venda; sangria e close nem foram tentados.
    expect(seen).toEqual(["cashSession.open", "sale.create"]);
    expect(items.get("3")?.status).toBe("pending");
    expect(items.get("4")?.status).toBe("pending");
  });

  it("3) predecessor em dead-letter bloqueia os sucessores (CLOSE nunca antes)", async () => {
    const ops = sessionOps();
    ops[1] = { ...ops[1], attempts: 4 }; // venda a 1 tentativa do dead-letter
    const { store, items } = fakeOutbox(ops);
    const seen: string[] = [];
    // 1º drain: a venda esgota tentativas → dead-letter → PARA.
    await drainOutbox(store, async (it) => {
      seen.push(it.type);
      if (it.type === "sale.create") throw new Error("produto sumiu");
      return {};
    });
    expect(items.get("2")?.status).toBe("failed");
    // 2º drain: há item morto na frente → não drena mais nada.
    const before = [...seen];
    await drainOutbox(store, async (it) => {
      seen.push(it.type);
      return {};
    });
    expect(seen).toEqual(before); // nenhum novo replay
    expect(seen).not.toContain("cashSession.close"); // CLOSE nunca antes da venda
    expect(items.get("4")?.status).toBe("pending");
  });

  it("4) retry do predecessor libera a fila", async () => {
    const ops = sessionOps();
    ops[0] = { ...ops[0], status: "done" }; // OPEN já sincronizado
    ops[1] = { ...ops[1], status: "failed", attempts: 5 }; // venda já morta
    const { store, items } = fakeOutbox(ops);
    // retry re-arma a venda para pending.
    await store.update("2", {
      status: "pending",
      attempts: 0,
      lastError: undefined,
    });
    const seen: string[] = [];
    const res = await drainOutbox(store, async (it) => {
      seen.push(it.type);
      return {};
    });
    expect(seen).toEqual(["sale.create", "cash.sangria", "cashSession.close"]);
    expect(res.synced).toBe(3);
    expect(items.get("4")?.status).toBe("done");
  });
});
