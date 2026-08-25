import "dotenv/config";
import {
  loadSchemaDictionary,
  resolveTable,
} from "@/features/erp-sync/server/oracle-explorer/dictionary";

// Inspeção READ-ONLY do dicionário de schema (ALL_TABLES/ALL_TAB_COLUMNS/
// ALL_IND_COLUMNS — catálogo do Oracle, não dado de negócio) — mesmo caminho
// que a UI usa ao abrir "Fonte" no montador. Serve só pra confirmar nomes de
// coluna reais antes de escrever um template, em vez de supor pelo glossário.
//
// Como rodar: os módulos de `oracle-explorer/*` têm `import "server-only"`,
// que quebra fora do bundler do Next. Rode com um stub que intercepta esse
// require (não altera nada do repo):
//
//   cat > /tmp/stub-server-only.cjs <<'EOF'
//   const Module = require("node:module");
//   const orig = Module._load;
//   Module._load = function (r, ...a) { return r === "server-only" ? {} : orig.call(this, r, ...a); };
//   EOF
//   NODE_OPTIONS="--require /tmp/stub-server-only.cjs" npx tsx scripts/inspect-oracle-schema.ts

const ORG_ID = "SX99VyjCVlkXq8R9uTGC05bTTaoywraV";
// Edite a lista abaixo para as tabelas que quiser inspecionar.
const TABLES_TO_INSPECT = ["PCMETA", "PCMETARCA", "PCPEDC"];

async function main() {
  const dict = await loadSchemaDictionary(ORG_ID);
  console.log(`tabelas descobertas: ${dict.tables.size}`);

  for (const name of TABLES_TO_INSPECT) {
    try {
      const table = resolveTable(dict, name);
      console.log(`\n=== ${table.name} (${table.rowCount ?? "?"} linhas) ===`);
      for (const col of table.columns.values()) {
        console.log(
          `  ${col.name.padEnd(20)} ${col.dataType.padEnd(12)} ${col.role}${col.leadingIndex ? " [índice líder]" : ""}`,
        );
      }
    } catch (error) {
      console.log(`\n=== ${name}: ${(error as Error).message} ===`);
    }
  }
}

main()
  .catch((error) => {
    console.error("❌", error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
