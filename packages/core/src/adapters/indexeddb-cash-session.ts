import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import {
  canTransitionCashSession,
  type LocalCashSession,
} from "../cash-session";
import type { CashSessionStore } from "../cash-session-store";

interface CashSchema extends DBSchema {
  session: { key: string; value: LocalCashSession };
}

const STORE = "session";
const KEY = "current";

/** Store da sessão de caixa em IndexedDB (web/dev). Uma linha: a sessão corrente. */
export function createIndexedDbCashSessionStore(
  dbName = "nerp-cash",
): CashSessionStore {
  let dbPromise: Promise<IDBPDatabase<CashSchema>> | null = null;
  const db = () => {
    dbPromise ??= openDB<CashSchema>(dbName, 1, {
      upgrade(database) {
        database.createObjectStore(STORE);
      },
    });
    return dbPromise;
  };

  const read = async (): Promise<LocalCashSession | null> =>
    (await (await db()).get(STORE, KEY)) ?? null;
  const write = async (session: LocalCashSession) => {
    await (await db()).put(STORE, session, KEY);
  };

  return {
    getCurrent: read,
    async open(session) {
      await write(session);
    },
    async addMovement(movement) {
      const cur = await read();
      if (!cur) throw new Error("Nenhuma sessão de caixa aberta");
      cur.movements = [...cur.movements, movement];
      await write(cur);
    },
    async close(countedBalance, closedAt) {
      const cur = await read();
      if (!cur) throw new Error("Nenhuma sessão de caixa aberta");
      if (!canTransitionCashSession(cur.status, "closed"))
        throw new Error("Sessão de caixa já fechada");
      await write({
        ...cur,
        status: "closed",
        countedBalance,
        closedAt,
      });
    },
    async clear() {
      await (await db()).delete(STORE, KEY);
    },
  };
}
