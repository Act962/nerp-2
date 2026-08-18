import { describe, expect, it } from "vitest";
import { drainOutbox, type Outbox } from "./outbox";
import type { OutboxItem } from "./types";

// Outbox fake em memória para testar o orquestrador de drain.
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

  it("dead-letter após esgotar as tentativas, sem travar as próximas", async () => {
    const almost: OutboxItem = { ...item("1"), attempts: 4 };
    const { store, items } = fakeOutbox([almost, item("2")]);
    const result = await drainOutbox(store, async (it) => {
      if (it.id === "1") throw new Error("produto sumiu");
      return { saleNumber: 200 };
    });

    expect(items.get("1")?.status).toBe("failed"); // dead-letter (5ª tentativa)
    expect(result.failed).toBe(1);
    expect(items.get("2")?.status).toBe("done"); // seguiu para a próxima
    expect(result.synced).toBe(1);
  });
});
