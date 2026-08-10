import "dotenv/config";
import { loadOracleConfig } from "@/features/erp-sync/server/connectors";
import { withOracleReadOnly } from "@/features/erp-sync/server/oracle-client";

const ORG_ID = "SX99VyjCVlkXq8R9uTGC05bTTaoywraV";

async function main() {
  const cfg = await loadOracleConfig(ORG_ID);
  await withOracleReadOnly(cfg, async (query) => {
    const [all] = await query<{ N: number }>(
      `SELECT COUNT(*) AS N FROM ${cfg.schema}.PCCLIENT WHERE DTCADASTRO >= DATE '2025-01-01'`,
    );
    const [active] = await query<{ N: number }>(
      `SELECT COUNT(*) AS N FROM ${cfg.schema}.PCCLIENT WHERE DTCADASTRO >= DATE '2025-01-01' AND (BLOQUEIO IS NULL OR BLOQUEIO <> 'S')`,
    );
    console.log("Clientes DTCADASTRO >= 2025-01-01");
    console.log("  Total:", all?.N);
    console.log("  Ativos (nao bloqueados):", active?.N);
    console.log();
    const sample = await query<Record<string, string | number | null>>(
      `SELECT CODCLI, FANTASIA, CLIENTE, CGCENT, ENDERENT, NUMEROENT, BAIRROENT, MUNICENT, UFRG, CEPENT, TELENT, EMAIL, DTCADASTRO, BLOQUEIO
       FROM ${cfg.schema}.PCCLIENT
       WHERE DTCADASTRO >= DATE '2025-01-01'
       ORDER BY DTCADASTRO DESC
       FETCH FIRST 6 ROWS ONLY`,
    );
    console.log("AMOSTRA (6):");
    for (const r of sample) console.log(JSON.stringify(r));
  });
}
main().catch((e) => { console.error("ERR:", e.stack || e); process.exit(1); }).finally(() => process.exit(0));
