import "dotenv/config";
import { loadOracleConfig } from "@/features/erp-sync/server/connectors";
import { withOracleReadOnly } from "@/features/erp-sync/server/oracle-client";
import { loadSchemaDictionary, resolveTable } from "@/features/erp-sync/server/oracle-explorer/dictionary";

const ORG_ID = "SX99VyjCVlkXq8R9uTGC05bTTaoywraV";

async function main() {
  const cfg = await loadOracleConfig(ORG_ID);
  const dict = await loadSchemaDictionary(ORG_ID);
  const t = resolveTable(dict, "PCCLIENT");
  const cols = [...t.columns.values()].filter(c => /UF|ESTADO|SIGLA/i.test(c.name));
  console.log("Colunas UF/ESTADO no PCCLIENT:");
  for (const c of cols) console.log(`  ${c.name}`);
  console.log();
  await withOracleReadOnly(cfg, async (query) => {
    const sample = await query<Record<string, unknown>>(
      `SELECT UFRG, ESTCOB, ESTENT, ESTCOM, ESTEMPR
       FROM ${cfg.schema}.PCCLIENT
       WHERE DTCADASTRO >= DATE '2025-01-01' AND ROWNUM <= 5`,
    );
    console.log("AMOSTRA (UF cols):");
    for (const r of sample) console.log(JSON.stringify(r));
  });
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); }).finally(() => process.exit(0));
