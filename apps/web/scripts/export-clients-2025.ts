import "dotenv/config";
import * as XLSX from "xlsx";
import { loadOracleConfig } from "@/features/erp-sync/server/connectors";
import { withOracleReadOnly } from "@/features/erp-sync/server/oracle-client";

const ORG_ID = "SX99VyjCVlkXq8R9uTGC05bTTaoywraV";
const OUT = "/private/tmp/claude-501/-Users-weydsonlima-nerp-2/8d2b9879-3793-4031-b435-ee2757e9e4c8/scratchpad/lojas-armazem-carvalho-2025.xlsx";

interface Row {
  CODCLI: number;
  FANTASIA: string | null;
  CLIENTE: string;
  CGCENT: string | null;
  ENDERENT: string | null;
  NUMEROENT: string | null;
  BAIRROENT: string | null;
  MUNICENT: string | null;
  ESTENT: string | null;
  CEPENT: string | null;
  BLOQUEIO: string | null;
}

const digits = (v: string | null | undefined) =>
  v ? v.replace(/\D+/g, "") : "";

async function main() {
  const cfg = await loadOracleConfig(ORG_ID);
  const rows = await withOracleReadOnly(cfg, (query) =>
    query<Row>(
      `SELECT CODCLI, FANTASIA, CLIENTE, CGCENT, ENDERENT, NUMEROENT, BAIRROENT, MUNICENT, ESTENT, CEPENT, BLOQUEIO
       FROM ${cfg.schema}.PCCLIENT
       WHERE DTCADASTRO >= DATE '2025-01-01'
       ORDER BY CODCLI`,
    ),
  );

  const sheet = rows.map((r) => {
    const fantasia = r.FANTASIA?.trim();
    const razao = r.CLIENTE?.trim();
    const notes = [
      fantasia && razao && fantasia !== razao ? `Razão social: ${razao}` : null,
      r.BLOQUEIO === "S" ? "Bloqueado no Winthor" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      Nome: fantasia || razao || `CODCLI ${r.CODCLI}`,
      CNPJ: digits(r.CGCENT),
      Código: String(r.CODCLI),
      Endereço: r.ENDERENT?.trim() ?? "",
      Número: r.NUMEROENT?.trim() ?? "",
      Bairro: r.BAIRROENT?.trim() ?? "",
      CEP: digits(r.CEPENT),
      Cidade: r.MUNICENT?.trim() ?? "",
      Estado: r.ESTENT?.trim() ?? "",
      Observação: notes,
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheet);
  XLSX.utils.book_append_sheet(wb, ws, "Lojas");
  XLSX.writeFile(wb, OUT);
  console.log(`Wrote ${rows.length} rows to ${OUT}`);
  console.log("Sample:", JSON.stringify(sheet.slice(0, 2), null, 2));
}
main().catch(e => { console.error("ERR:", e.stack || e); process.exit(1); }).finally(() => process.exit(0));
