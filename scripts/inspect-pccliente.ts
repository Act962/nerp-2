import "dotenv/config";
import {
  loadSchemaDictionary,
  resolveTable,
} from "@/features/erp-sync/server/oracle-explorer/dictionary";

const ORG_ID = "SX99VyjCVlkXq8R9uTGC05bTTaoywraV";
async function main() {
  const dict = await loadSchemaDictionary(ORG_ID);
  const table = resolveTable(dict, "PCCLIENT");
  console.log(`PCCLIENT: ${table.rowCount ?? "?"} linhas`);
  const cols = [...table.columns.values()];
  console.log("TOTAL cols:", cols.length);
  const relevant = cols.filter((c) =>
    /CNPJ|CGC|CPF|IE|NOME|FANTASIA|FAN|ENDER|LOGRA|BAIRRO|CIDADE|MUNIC|UF|ESTADO|CEP|COMPLE|NUMERO|TELE|CELUL|EMAIL|CONTATO|GERENTE|DTCAD|CADASTRO|CODCLI|BLOQUEIO|ATIVO/i.test(
      c.name,
    ),
  );
  for (const c of relevant)
    console.log(`  ${c.name.padEnd(24)} ${c.dataType.padEnd(12)} ${c.role}`);
}
main()
  .catch((e) => {
    console.error("ERR:", e.stack || e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
