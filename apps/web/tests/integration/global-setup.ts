import { execSync } from "node:child_process";
import path from "node:path";
import { loadTestEnv } from "./env";

/**
 * Roda uma vez por execução da suíte: aplica as migrations no banco de teste.
 *
 * `migrate deploy` (não `migrate dev`) porque o banco de teste deve refletir
 * exatamente o que vai para produção — inclusive as migrations escritas à mão.
 */
export default function setup() {
  const databaseUrl = loadTestEnv();
  const cwd = path.resolve(__dirname, "../..");

  execSync("pnpm exec prisma migrate deploy", {
    cwd,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
