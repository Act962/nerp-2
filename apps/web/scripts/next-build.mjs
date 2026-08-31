// Roda `next build` com heap maior que o padrão do Node.
//
// A fase "Linting and checking validity of types" do build estoura o teto de
// heap do V8 e o worker é ABORTADO — sem imprimir erro. O log simplesmente
// para depois de "✓ Compiled successfully", o que faz a falha parecer
// travamento de máquina. Foi o que derrubou os deploys de 638e0b6 e d04e055.
//
// O teto padrão vem da RAM da máquina: no runner do CI (16 GB) o Node assume
// 4 GB e passa — por isso `pnpm test` e o job de e2e ficam verdes e o problema
// só aparece no deploy, num servidor menor, onde o padrão fica em ~2 GB.
//
// Por que um wrapper e não `NODE_OPTIONS=... next build` no script:
//   1. Prefixo de variável no npm script quebra no Windows, e o repo tem
//      checkout Windows (ver .gitattributes no CLAUDE.md).
//   2. O `nixpacks.toml` não serve: o Coolify passa `--build-cmd` na linha de
//      comando, e isso SOBRESCREVE a fase de build do arquivo. Qualquer ajuste
//      lá é silenciosamente ignorado no deploy.
// Aqui dentro do script `build` do app, o ajuste vale para todo mundo que
// chama `next build` — turbo, CI, Coolify ou a mão.
//
// É TETO, não reserva: a folga impede o coletor de lixo de desistir quando
// encosta no limite.
//
// Foi de 4096 para 8192 em 30/08/2026, junto com o módulo de WhatsApp/CRM: o
// schema passou de ~126 para 174 modelos e o client gerado do Prisma foi a
// 23 MB, e a fase de coleta de dados das páginas passou a estourar 4 GB
// (`Ineffective mark-compacts near heap limit`, medido duas vezes). Com 8192 o
// build conclui. ATENÇÃO: isto é teto do V8, não RAM da máquina — num servidor
// com menos que isso o processo é morto pelo kernel antes de o teto valer.

import { spawn } from "node:child_process";

const HEAP_MB = 8192;

// Preserva o que já vier no ambiente — se alguém definiu um limite maior de
// propósito, o último argumento é o que o V8 considera, então o nosso vence
// apenas quando não há outro.
const nodeOptions = [
  process.env.NODE_OPTIONS,
  `--max-old-space-size=${HEAP_MB}`,
]
  .filter(Boolean)
  .join(" ");

const build = spawn("next", ["build"], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
  // No Windows o binário é `next.cmd`, que só resolve através do shell.
  shell: process.platform === "win32",
});

build.on("error", (erro) => {
  console.error("Falha ao iniciar o next build:", erro.message);
  process.exit(1);
});

build.on("exit", (code, signal) => {
  // Sinal sem código é justamente o caso do worker abortado: precisa virar
  // saída diferente de zero, senão o deploy segue achando que deu certo.
  if (signal) {
    console.error(`next build terminou por sinal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
