import Database from "@tauri-apps/plugin-sql";
import type { Outbox } from "../outbox";
import type { OutboxItem } from "../types";

/**
 * Outbox em SQLite (Tauri nativo). Mesma `Outbox` do adapter IndexedDB.
 * ⚠️ Só roda dentro do Tauri — ver nota no `sqlite-catalog.ts`.
 */
const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  lastError TEXT,
  result TEXT
);
`;

type OutboxRow = {
  id: string;
  type: string;
  payload: string;
  status: OutboxItem["status"];
  attempts: number;
  createdAt: string;
  lastError: string | null;
  result: string | null;
};

const toItem = (row: OutboxRow): OutboxItem => ({
  id: row.id,
  type: row.type,
  payload: JSON.parse(row.payload),
  status: row.status,
  attempts: row.attempts,
  createdAt: row.createdAt,
  lastError: row.lastError ?? undefined,
  result: row.result ? JSON.parse(row.result) : undefined,
});

export async function createSqliteOutbox(
  path = "sqlite:nerp-catalog.db",
): Promise<Outbox> {
  const db = await Database.load(path);
  await db.execute(CREATE_SQL);

  return {
    async enqueue(op) {
      await db.execute(
        `INSERT INTO outbox (id, type, payload, status, attempts, createdAt)
         VALUES ($1, $2, $3, 'pending', 0, $4)`,
        [op.id, op.type, JSON.stringify(op.payload), new Date().toISOString()],
      );
    },

    async pending() {
      const rows = await db.select<OutboxRow[]>(
        "SELECT * FROM outbox WHERE status = 'pending' ORDER BY createdAt ASC",
      );
      return rows.map(toItem);
    },

    async failed() {
      const rows = await db.select<OutboxRow[]>(
        "SELECT * FROM outbox WHERE status = 'failed' ORDER BY createdAt ASC",
      );
      return rows.map(toItem);
    },

    async update(id, patch) {
      const rows = await db.select<OutboxRow[]>(
        "SELECT * FROM outbox WHERE id = $1",
        [id],
      );
      const current = rows[0];
      if (!current) return;
      const next = { ...toItem(current), ...patch };
      await db.execute(
        `UPDATE outbox SET status=$1, attempts=$2, lastError=$3, result=$4 WHERE id=$5`,
        [
          next.status,
          next.attempts,
          next.lastError ?? null,
          next.result ? JSON.stringify(next.result) : null,
          id,
        ],
      );
    },

    async countPending() {
      const rows = await db.select<{ n: number }[]>(
        "SELECT COUNT(*) as n FROM outbox WHERE status = 'pending'",
      );
      return rows[0]?.n ?? 0;
    },
  };
}
