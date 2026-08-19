import Database from "@tauri-apps/plugin-sql";
import {
  canTransitionCashSession,
  type LocalCashSession,
} from "../cash-session";
import type { CashSessionStore } from "../cash-session-store";

/**
 * Store da sessão de caixa em SQLite via `@tauri-apps/plugin-sql` (Tauri nativo).
 * Uma linha (`k = "current"`) guardando a sessão inteira serializada em JSON.
 * ⚠️ Só roda dentro do Tauri — mesmo molde do `sqlite-catalog.ts`.
 */
const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS cash_session (k TEXT PRIMARY KEY, v TEXT NOT NULL);
`;
const KEY = "current";

export async function createSqliteCashSessionStore(
  path = "sqlite:nerp-catalog.db",
): Promise<CashSessionStore> {
  const db = await Database.load(path);
  await db.execute(CREATE_SQL);

  const read = async (): Promise<LocalCashSession | null> => {
    const rows = await db.select<{ v: string }[]>(
      "SELECT v FROM cash_session WHERE k = $1",
      [KEY],
    );
    return rows[0] ? (JSON.parse(rows[0].v) as LocalCashSession) : null;
  };
  const write = async (session: LocalCashSession) => {
    await db.execute(
      "INSERT INTO cash_session (k, v) VALUES ($1, $2) ON CONFLICT(k) DO UPDATE SET v = $2",
      [KEY, JSON.stringify(session)],
    );
  };

  return {
    getCurrent: read,
    async open(session) {
      await write(session);
    },
    async addMovement(movement) {
      const cur = await read();
      if (!cur) throw new Error("Nenhuma sessão de caixa aberta");
      cur.movements.push(movement);
      await write(cur);
    },
    async close(countedBalance, closedAt) {
      const cur = await read();
      if (!cur) throw new Error("Nenhuma sessão de caixa aberta");
      if (!canTransitionCashSession(cur.status, "closed"))
        throw new Error("Sessão de caixa já fechada");
      await write({ ...cur, status: "closed", countedBalance, closedAt });
    },
    async clear() {
      await db.execute("DELETE FROM cash_session WHERE k = $1", [KEY]);
    },
  };
}
