import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/**
 * Carrega `.env.test` e recusa rodar contra qualquer banco que não seja o de
 * teste.
 *
 * A trava não é paranoia: a suíte de integração TRUNCA tabelas. Sem ela, um
 * `.env.test` ausente faria o `DATABASE_URL` do `.env` valer e a primeira
 * execução limparia o banco de desenvolvimento.
 */
export function loadTestEnv(): string {
  const envPath = path.resolve(__dirname, "../../.env.test");
  if (!existsSync(envPath)) {
    throw new Error(
      "apps/web/.env.test não existe. Copie de .env.test.example e suba o banco com `docker compose up -d db-test`.",
    );
  }

  dotenv.config({ path: envPath, override: true });

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente em apps/web/.env.test");
  if (!/test/i.test(url)) {
    throw new Error(
      `DATABASE_URL do .env.test não parece um banco de teste (${url.replace(/:[^:@]+@/, ":***@")}). Abortando para não truncar dados reais.`,
    );
  }

  return url;
}
