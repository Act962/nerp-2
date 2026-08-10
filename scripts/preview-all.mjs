#!/usr/bin/env node
// Reconstrói `preview/tudo-local` do zero mergeando todas as branches `feat/*`
// (remotas em origin) na main atualizada. Útil pra ver todas as features em
// desenvolvimento juntas no localhost sem esperar merge em prod.
//
// Uso: pnpm preview:all              # mergeia todas as feat/*
//      pnpm preview:all feat/pdv-*   # padrão glob
//      pnpm preview:all --dry-run    # só lista o que vai fazer
//
// Idempotente: rodar de novo recria a branch do zero.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PREVIEW_BRANCH = "preview/tudo-local";
// Arquivos "aditivos" onde `merge=union` costuma resolver sozinho (mantém os
// dois lados sem marcadores). Fixups abaixo cuidam do que sobra.
const UNION_ATTRS = `prisma/schema.prisma merge=union
src/lib/permissions.ts merge=union
src/components/app-sidebar.tsx merge=union
src/app/router/index.ts merge=union
`;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const patterns = args.filter((arg) => !arg.startsWith("--"));

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf8", ...opts }).trim();
}
function shLive(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
}
function log(msg) {
  console.log(`\n\x1b[36m▸\x1b[0m ${msg}`);
}
function warn(msg) {
  console.log(`\x1b[33m!\x1b[0m ${msg}`);
}
function ok(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}
function die(msg) {
  console.error(`\x1b[31m✗\x1b[0m ${msg}`);
  process.exit(1);
}

// ─── 1) Sanidade ────────────────────────────────────────────────────────────
const status = sh("git status --porcelain");
if (status)
  die(
    "Working tree sujo. Commite ou stash antes:\n" +
      status
        .split("\n")
        .map((line) => `   ${line}`)
        .join("\n"),
  );

const startingBranch = sh("git rev-parse --abbrev-ref HEAD");

// ─── 2) Fetch ───────────────────────────────────────────────────────────────
log("Fetch origin --prune");
shLive("git fetch origin --prune");

// ─── 3) Descobre as branches feat/* remotas ─────────────────────────────────
const allFeats = sh("git branch -r --list 'origin/feat/*'")
  .split("\n")
  .map((line) => line.trim().replace(/^origin\//, ""))
  .filter(Boolean);

function matches(branch) {
  if (patterns.length === 0) return true;
  return patterns.some((pattern) => {
    // glob simples: só * é reconhecido
    const rx = new RegExp(
      `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
    );
    return rx.test(branch);
  });
}

const branches = allFeats.filter(matches);
if (branches.length === 0) die("Nenhuma branch feat/* encontrada em origin.");

log(`Branches que serão mergeadas em ${PREVIEW_BRANCH}:`);
for (const branch of branches) console.log(`   • ${branch}`);
if (DRY_RUN) {
  console.log("\n(--dry-run) Nada foi feito.");
  process.exit(0);
}

// ─── 4) Recria preview/tudo-local do main atualizado ────────────────────────
log(`Sincroniza main com origin/main`);
shLive("git checkout main -q");
shLive("git pull --ff-only origin main");

log(`Recria ${PREVIEW_BRANCH} do main`);
if (sh(`git branch --list ${PREVIEW_BRANCH}`))
  shLive(`git branch -D ${PREVIEW_BRANCH}`);
shLive(`git checkout -b ${PREVIEW_BRANCH}`);

// ─── 5) .gitattributes com union merges ─────────────────────────────────────
writeFileSync(".gitattributes", UNION_ATTRS);
shLive("git add .gitattributes");
sh(
  'git commit -q -m "chore(preview): union merge p/ arquivos aditivos (branch descartável)"',
);

// ─── 6) Mergeia cada branch ─────────────────────────────────────────────────
const merged = [];
const skipped = [];
for (const branch of branches) {
  log(`Merge ${branch}`);
  try {
    execSync(`git merge --no-edit origin/${branch}`, { stdio: "inherit" });
    merged.push(branch);
    continue;
  } catch {
    // Aplica fixups conhecidos e tenta commitar automaticamente.
    const applied = applyKnownFixups();
    const conflictsLeft = sh("git diff --name-only --diff-filter=U")
      .split("\n")
      .filter(Boolean);

    if (conflictsLeft.length === 0 && applied) {
      shLive(`git commit --no-edit -q`);
      merged.push(branch);
      ok(`  fixups automáticos resolveram: ${applied.join(", ")}`);
      continue;
    }
    warn(
      `Conflitos não resolvidos em ${branch}:\n${conflictsLeft
        .map((line) => `   • ${line}`)
        .join("\n")}\n   Abortando merge desta branch.`,
    );
    shLive("git merge --abort");
    skipped.push({ branch, conflicts: conflictsLeft });
  }
}

// ─── 7) Fixups pós-merge (mesmo sem conflito, o union pode ter quebrado) ────
log("Fixups pós-merge (schema + arrays)");
const postFixups = applyKnownFixups();
if (postFixups.length > 0) {
  shLive(`git add -A`);
  sh(
    `git commit -q -m "fix(preview): fixups automáticos (${postFixups.join(", ")})"`,
  );
  ok(`aplicado: ${postFixups.join(", ")}`);
} else {
  ok("nada a corrigir");
}

// ─── 8) Bump SCHEMA_VERSION e regenera Prisma client ────────────────────────
bumpSchemaVersion();
log("prisma generate");
try {
  shLive("npx prisma generate");
} catch {
  warn("prisma generate falhou — inspecione prisma/schema.prisma");
}

// ─── 9) Typecheck rápido pra validar (não bloqueia) ─────────────────────────
log("Typecheck");
try {
  shLive("npx tsc --noEmit");
  ok("tsc limpo");
} catch {
  warn("tsc tem erros — inspecione acima.");
}

// ─── 10) Resumo ─────────────────────────────────────────────────────────────
console.log(
  `\n\x1b[32m✓\x1b[0m ${PREVIEW_BRANCH} pronto. Você continua nesta branch — reinicie o dev server:`,
);
console.log(`  pkill -f "next dev"; pnpm dev\n`);
console.log(`Branch anterior (pra voltar depois):  git checkout ${startingBranch}\n`);

if (merged.length > 0) {
  console.log(`Mergeadas (${merged.length}):`);
  for (const branch of merged) console.log(`   ✓ ${branch}`);
}
if (skipped.length > 0) {
  console.log(`\nPuladas por conflito (${skipped.length}):`);
  for (const { branch, conflicts } of skipped) {
    console.log(`   ✗ ${branch}`);
    for (const conflict of conflicts) console.log(`      ${conflict}`);
  }
  console.log(
    `\n   Resolva na branch feat/* de origem ou trate no fixup em scripts/preview-all.mjs.`,
  );
}

// ─── Fixups conhecidos ──────────────────────────────────────────────────────
// Ficam listados aqui pra evoluir sozinhos conforme padrões novos aparecerem.
// Retorna a lista de fixups aplicados nesta rodada.
function applyKnownFixups() {
  const applied = [];

  // 1) prisma/schema.prisma — chave } de fechamento após @@map(...) some quando
  //    duas features adicionam models em sequência e o union descarta o \n} \n
  //    entre elas. Detecção: `@@map("...")\n` seguido de linha que NÃO é `}`.
  const schemaPath = "prisma/schema.prisma";
  if (existsSync(schemaPath)) {
    const before = readFileSync(schemaPath, "utf8");
    const after = before.replace(
      /(@@map\("[^"]+"\))\n(?!})/g,
      (_, mapLine) => `${mapLine}\n}\n`,
    );
    if (before !== after) {
      writeFileSync(schemaPath, after);
      applied.push("schema-braces");
    }
  }

  // 2) src/lib/permissions.ts — dois objetos {key,label,href} fundidos num
  //    único literal (padrão do union). Ex.:
  //      { key: "a", label: "A", href: "/a",
  //        key: "b", label: "B", href: "/b" }
  //    Split em dois objetos separados.
  const permsPath = "src/lib/permissions.ts";
  if (existsSync(permsPath)) {
    const before = readFileSync(permsPath, "utf8");
    const after = before.replace(
      /(\{\s*key:\s*"[^"]+",\s*label:\s*"[^"]+",\s*href:\s*"[^"]+",)\s*(key:\s*"[^"]+",\s*label:\s*"[^"]+",\s*href:\s*"[^"]+",?)\s*\}/g,
      (_, first, second) => {
        const cleanFirst = first.replace(/,$/, "");
        const cleanSecond = second.replace(/,$/, "");
        return `{ ${cleanFirst.replace(/^\{\s*/, "")} },\n  { ${cleanSecond} }`;
      },
    );
    if (before !== after) {
      writeFileSync(permsPath, after);
      applied.push("permissions-split");
    }
  }

  // 3) src/components/app-sidebar.tsx — duplicação nas listas de nav. Detecção
  //    conservadora: procura duas linhas consecutivas idênticas com "name:".
  const sidebarPath = "src/components/app-sidebar.tsx";
  if (existsSync(sidebarPath)) {
    const before = readFileSync(sidebarPath, "utf8");
    // De-duplica linhas consecutivas idênticas em children arrays (mesmo indent
    // + mesmo objeto inline).
    const after = before.replace(
      /(^\s*\{ name: "[^"]+", href: "[^"]+", icon: [A-Za-z]+ \},\n)\1/gm,
      "$1",
    );
    if (before !== after) {
      writeFileSync(sidebarPath, after);
      applied.push("sidebar-dedup");
    }
  }

  return applied;
}

// SCHEMA_VERSION do runtime cache do Prisma. Bumpa pra um valor único desta
// preview — senão o dev roda com Client cacheado de outra composição.
function bumpSchemaVersion() {
  const path = "src/lib/db.ts";
  if (!existsSync(path)) return;
  const now = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 12);
  const before = readFileSync(path, "utf8");
  const after = before.replace(
    /const\s+SCHEMA_VERSION\s*=\s*"[^"]+";/,
    `const SCHEMA_VERSION = "preview-${now}";`,
  );
  if (before !== after) {
    writeFileSync(path, after);
    shLive(`git add ${path}`);
    sh(`git commit -q -m "chore(preview): bump SCHEMA_VERSION"`);
    ok(`SCHEMA_VERSION → preview-${now}`);
  }
}
