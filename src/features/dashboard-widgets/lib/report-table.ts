import type { WidgetValue } from "./widget-value";

// Colunas DERIVADAS para widgets-relatório (146/114 do Winthor). O motor Oracle
// só agrega uma tabela, então venda e custo vêm dele; aqui, no cliente, a
// gente calcula o que é razão/acumulado a partir dessas colunas — sem join nem
// tabela de metas. Conferido contra o relatório 114 real:
//   • % Part.  = venda da linha / venda total        (coluna "%" do relatório)
//   • Contrib. = venda − custo                        (= "Vl. Contrib.")
//   • % Lucro  = (venda − custo) / venda              (= "%Luc.")
//   • % MC     = contrib da linha / contrib total     (= "% MC")
//   • % Acum.  = soma cumulativa de % MC quando há custo; senão, de % Part.
// (linhas já vêm ordenadas por venda desc, então o acumulado bate com o papel.)

export interface ReportTableConfig {
  /** Chave da coluna de venda (base de % e acumulado). Default "M0". */
  valueKey: string;
  /** Chave da coluna de custo — habilita Contrib. e % Lucro. Ausente = off. */
  costKey?: string;
}

export function readReportConfig(options: unknown): ReportTableConfig | null {
  const raw = (options as { report?: unknown } | null)?.report;
  if (!raw || typeof raw !== "object") return null;
  const cfg = raw as { valueKey?: unknown; costKey?: unknown };
  return {
    valueKey: typeof cfg.valueKey === "string" ? cfg.valueKey : "M0",
    costKey: typeof cfg.costKey === "string" ? cfg.costKey : undefined,
  };
}

function pct(value: number): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

/**
 * Devolve uma nova TABLE com as colunas derivadas anexadas. Se a coluna de
 * venda não existir, devolve a tabela intacta (nunca quebra o render).
 * Percentuais entram como STRING já formatada (2 casas) — a TableWidget só
 * arredonda para inteiro quando o valor é number+unit percent.
 */
export function augmentReportTable(
  value: Extract<WidgetValue, { kind: "TABLE" }>,
  config: ReportTableConfig,
): Extract<WidgetValue, { kind: "TABLE" }> {
  const valueIdx = value.columns.findIndex((c) => c.key === config.valueKey);
  if (valueIdx < 0) return value;
  const costIdx = config.costKey
    ? value.columns.findIndex((c) => c.key === config.costKey)
    : -1;

  const num = (cell: string | number | null): number =>
    typeof cell === "number" ? cell : 0;

  const totalVenda = value.rows.reduce(
    (sum, r) => sum + num(r.cells[valueIdx]),
    0,
  );
  const totalContrib =
    costIdx >= 0
      ? value.rows.reduce(
          (sum, r) => sum + (num(r.cells[valueIdx]) - num(r.cells[costIdx])),
          0,
        )
      : 0;

  let acum = 0;
  const rows = value.rows.map((row) => {
    const venda = num(row.cells[valueIdx]);
    const part = totalVenda > 0 ? (venda / totalVenda) * 100 : 0;
    if (costIdx < 0) {
      acum += part;
      return { ...row, cells: [...row.cells, pct(part), pct(acum)] };
    }
    const custo = num(row.cells[costIdx]);
    const contrib = venda - custo;
    const lucro = venda > 0 ? (contrib / venda) * 100 : 0;
    const mc = totalContrib > 0 ? (contrib / totalContrib) * 100 : 0;
    acum += mc;
    return {
      ...row,
      cells: [...row.cells, pct(part), contrib, pct(lucro), pct(mc), pct(acum)],
    };
  });

  const columns = [
    ...value.columns,
    { key: "part", label: "% Part.", align: "right" as const },
    ...(costIdx >= 0
      ? [
          {
            key: "contrib",
            label: "Contrib.",
            align: "right" as const,
            unit: "currency" as const,
          },
          { key: "lucro", label: "% Lucro", align: "right" as const },
          { key: "mc", label: "% MC", align: "right" as const },
        ]
      : []),
    { key: "acum", label: "% Acum.", align: "right" as const },
  ];

  return { kind: "TABLE", columns, rows };
}
