import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { Outbox } from "../outbox";
import type { OutboxItem } from "../types";

/** Outbox em IndexedDB — storage web/PWA e do dev (onde a Fase 3 é verificada). */
interface OutboxSchema extends DBSchema {
  outbox: { key: string; value: OutboxItem };
}

const STORE = "outbox";

export function createIndexedDbOutbox(dbName = "nerp-outbox"): Outbox {
  let dbPromise: Promise<IDBPDatabase<OutboxSchema>> | null = null;
  const db = () => {
    dbPromise ??= openDB<OutboxSchema>(dbName, 1, {
      upgrade(database) {
        database.createObjectStore(STORE, { keyPath: "id" });
      },
    });
    return dbPromise;
  };

  return {
    async enqueue(op) {
      const database = await db();
      await database.put(STORE, {
        id: op.id,
        type: op.type,
        payload: op.payload,
        status: "pending",
        attempts: 0,
        createdAt: new Date().toISOString(),
      });
    },

    async pending() {
      const database = await db();
      const all = await database.getAll(STORE);
      return all
        .filter((item) => item.status === "pending")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async update(id, patch) {
      const database = await db();
      const current = await database.get(STORE, id);
      if (!current) return;
      await database.put(STORE, { ...current, ...patch });
    },

    async countPending() {
      return (await this.pending()).length;
    },
  };
}
