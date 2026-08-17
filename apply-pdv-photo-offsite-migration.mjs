// Aplica a migration 20260816120000_pdv_photo_offsite no Neon compartilhado.
// Usa `pg` direto (Neon com drift — memória migration-drift-cosmos). Script
// idempotente: checa `_prisma_migrations` e sai limpo se já aplicou.
//
// Rodar: cd /Users/weydsonlima/nerp-2 && node apply-pdv-photo-offsite-migration.mjs

import { readFileSync } from "node:fs";
import { Client } from "pg";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();

const migName = "20260816120000_pdv_photo_offsite";
const sql = readFileSync(`prisma/migrations/${migName}/migration.sql`, "utf8");

const existing = await client.query(
  'SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1 AND finished_at IS NOT NULL',
  [migName],
);
if (existing.rowCount > 0) {
  console.log("Migration já aplicada — saindo.");
  await client.end();
  process.exit(0);
}

console.log("Aplicando migration:", migName);
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query(
    `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES (gen_random_uuid()::text, 'manual-pdv-photo-offsite', NOW(), $1, NULL, NULL, NOW(), 1)
     ON CONFLICT DO NOTHING`,
    [migName],
  );
  await client.query("COMMIT");
  console.log("OK — pdv_photos.offSite adicionado.");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("FALHOU:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
