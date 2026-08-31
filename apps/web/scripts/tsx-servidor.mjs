// Roda um script `tsx` que importa módulos marcados com `server-only`.
//
// O pacote `server-only` estoura de propósito quando alguém o carrega fora do
// servidor. Fora do bundler do Next não existe a condição de resolução que ele
// espera, então até um script de terminal — que é servidor por definição — cai
// no arquivo que estoura.
//
// A saída é ligar a condição `react-server`, que faz o pacote resolver para o
// módulo vazio. Assim o script reaproveita a cifra e os helpers de verdade, em
// vez de duplicar a criptografia num script solto — que é como duas
// implementações da mesma coisa divergem sem ninguém perceber.
//
// Por que um wrapper e não `NODE_OPTIONS=... tsx` no package.json: prefixo de
// variável em npm script quebra no Windows, e o repo tem checkout Windows (ver
// `.gitattributes` no CLAUDE.md). Mesma razão de `next-build.mjs` e
// `check-types.mjs`.
//
// Uso:  node scripts/tsx-servidor.mjs scripts/algum-script.ts [args...]

import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tsx = require.resolve("tsx/cli");

const [script, ...args] = process.argv.slice(2);

if (!script) {
  console.error("Uso: node scripts/tsx-servidor.mjs <script.ts> [args...]");
  process.exit(1);
}

const nodeOptions = [process.env.NODE_OPTIONS, "--conditions=react-server"]
  .filter(Boolean)
  .join(" ");

const processo = spawn(process.execPath, [tsx, script, ...args], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
});

processo.on("error", (erro) => {
  console.error("Falha ao iniciar o tsx:", erro.message);
  process.exit(1);
});

processo.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Script terminou por sinal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
