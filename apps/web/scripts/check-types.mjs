// Roda `tsc --noEmit` com heap maior que o padrão do Node.
//
// Mesmo problema que `next-build.mjs` resolve para o build, agora na
// verificação de tipos: o client gerado do Prisma cresce junto com o schema
// (~174 models depois do CRM/WhatsApp) e o `tsc` passa a estourar o teto de
// heap do V8. O processo é ABORTADO por SIGKILL — o turbo mostra só
// `exited (137)`, sem nenhuma linha de erro de tipo, o que faz um problema de
// memória parecer erro de compilação.
//
// Por que um wrapper e não `NODE_OPTIONS=... tsc` no script: prefixo de
// variável em npm script quebra no Windows, e o repo tem checkout Windows
// (ver `.gitattributes` no CLAUDE.md). É a mesma razão registrada em
// `next-build.mjs`.
//
// É TETO, não reserva: medido, a verificação conclui bem abaixo disso. A folga
// só impede o coletor de lixo de desistir quando encosta no limite.

import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const HEAP_MB = 8192;

// Resolve o `tsc` pelo pacote em vez de confiar no PATH: sob `pnpm run` o
// `node_modules/.bin` entra no PATH, mas rodar o script direto (`node
// scripts/check-types.mjs`) não teria o binário e falharia com um ENOENT que
// parece erro de instalação.
const require = createRequire(import.meta.url);
const tsc = require.resolve("typescript/bin/tsc");

// Preserva o que já vier no ambiente — o último argumento é o que o V8
// considera, então o nosso só vence quando não há outro.
const nodeOptions = [
  process.env.NODE_OPTIONS,
  `--max-old-space-size=${HEAP_MB}`,
]
  .filter(Boolean)
  .join(" ");

// `process.execPath` + o entrypoint JS do tsc: funciona igual nos três
// sistemas, sem depender de `.cmd` nem de shell.
const check = spawn(process.execPath, [tsc, "--noEmit"], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
});

check.on("error", (erro) => {
  console.error("Falha ao iniciar o tsc:", erro.message);
  process.exit(1);
});

check.on("exit", (code, signal) => {
  // Sinal sem código é o caso do processo abortado por falta de memória:
  // precisa virar saída diferente de zero, senão o CI segue achando que passou.
  if (signal) {
    console.error(`tsc terminou por sinal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
