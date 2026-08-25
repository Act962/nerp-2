import type { WidgetValue } from "./widget-value";

// Colunas DERIVADAS para widgets-relatório (146/114 do Winthor). O motor Oracle
// só agrega uma tabela (e no máximo 6 medidas por consulta), então tudo que é
// RAZÃO entre duas medidas já buscadas é calculado aqui no cliente — sem
// gastar um measure slot extra e sem precisar de join nem tabela de metas.
// Conferido contra os relatórios reais:
//   • Ticket médio = venda / contagem                (= "Vl.Média Ped." / "Qt.média itens" quando countKey é NUMITENS)
//   • % Part.       = venda da linha / venda total     (coluna "%"/"%Part.vendas")
//   • % Desc        = (venda − tabela) / tabela        (coluna "%Desc" — negativo quando houve desconto)
//   • Contrib.      = venda − custo                    (= "Vl. Contrib.")
//   • % Lucro       = (venda − custo) / venda           (= "%Luc."/"%Lucro")
//   • % MC          = contrib da linha / contrib total  (= "% MC")
//   • % Acum.       = soma cumulativa de % MC (ou % Part. se não há custo)
// (linhas já vêm ordenadas por venda desc, então o acumulado bate com o papel.)

/** Escopos de meta suportados — batem com `DashboardSalesGoal.scope`. */
export type ReportGoalScope = "geral" | "supervisor" | "usuario";

export interface ReportTableConfig {
  /** Chave da coluna de venda (base de % Part./Acum./Ticket médio/Lucro). Default "M0". */
  valueKey: string;
  /** Chave de uma coluna de CONTAGEM — habilita "Vl. médio" = venda/contagem
   * (ex.: Ticket médio a partir de Qt. pedidos). Ausente = off. */
  countKey?: string;
  /** Chave da coluna de custo — habilita Contrib., % Lucro e % MC. Ausente = off. */
  costKey?: string;
  /** Chave da coluna de valor de TABELA (preço cheio) — habilita % Desc =
   * (venda − tabela) / tabela. Ausente = off. */
  tabelaKey?: string;
  /** Rótulo da coluna derivada de `countKey` (Ticket médio). Default "Vl. médio". */
  countLabel?: string;
  /** Escopo de meta NERP a casar com cada linha (`row.id` == `scopeCode`
   * salvo em DashboardSalesGoal) — habilita Vl.meta e %Meta. Ausente = off.
   * A meta NUNCA vem do Winthor: só o dado de venda vem de lá, a meta é
   * digitada pelo admin em "Metas de vendas" e casada aqui no cliente. */
  goalScope?: ReportGoalScope;
}

const GOAL_SCOPES: ReadonlySet<string> = new Set([
  "geral",
  "supervisor",
  "usuario",
]);

export function readReportConfig(options: unknown): ReportTableConfig | null {
  const raw = (options as { report?: unknown } | null)?.report;
  if (!raw || typeof raw !== "object") return null;
  const cfg = raw as Record<string, unknown>;
  const str = (key: string): string | undefined =>
    typeof cfg[key] === "string" ? (cfg[key] as string) : undefined;
  const goalScope = str("goalScope");
  return {
    valueKey: str("valueKey") ?? "M0",
    countKey: str("countKey"),
    costKey: str("costKey"),
    tabelaKey: str("tabelaKey"),
    countLabel: str("countLabel"),
    goalScope:
      goalScope && GOAL_SCOPES.has(goalScope)
        ? (goalScope as ReportGoalScope)
        : undefined,
  };
}

/** Metas do período corrente, indexadas por escopo → scopeCode → valor —
 * pronto pra passar como `goalsByCode` em `augmentReportTable` (o chamador
 * escolhe o Map certo via `reportConfig.goalScope`). */
export function buildGoalsByScope(
  goals: {
    scope: string;
    scopeCode: string;
    year: number;
    month: number;
    value: number;
  }[],
  year: number,
  month: number,
): Map<ReportGoalScope, Map<string, number>> {
  const map = new Map<ReportGoalScope, Map<string, number>>();
  for (const goal of goals) {
    if (goal.year !== year || goal.month !== month) continue;
    if (!GOAL_SCOPES.has(goal.scope)) continue;
    const scope = goal.scope as ReportGoalScope;
    const byCode = map.get(scope) ?? new Map<string, number>();
    byCode.set(goal.scopeCode, goal.value);
    map.set(scope, byCode);
  }
  return map;
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
  /** `scopeCode` (== `row.id`) → valor da meta do período corrente, já
   * filtrado por `config.goalScope` pelo chamador (org-dashboard-view /
   * org-dashboard-editor). Ausente ou linha sem meta cadastrada → célula
   * fica null (não força zero, pra não confundir "meta zero" com "sem meta"). */
  goalsByCode?: Map<string, number>,
): Extract<WidgetValue, { kind: "TABLE" }> {
  const colIndex = (key: string | undefined) =>
    key ? value.columns.findIndex((c) => c.key === key) : -1;

  const valueIdx = colIndex(config.valueKey);
  if (valueIdx < 0) return value;
  const countIdx = colIndex(config.countKey);
  const costIdx = colIndex(config.costKey);
  const tabelaIdx = colIndex(config.tabelaKey);
  const hasGoals = Boolean(config.goalScope) && Boolean(goalsByCode);

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
    const extra: (string | number | null)[] = [];

    if (countIdx >= 0) {
      const count = num(row.cells[countIdx]);
      extra.push(count > 0 ? venda / count : 0);
    }
    if (hasGoals) {
      const meta = goalsByCode?.get(row.id) ?? null;
      extra.push(meta);
    }
    extra.push(pct(part));
    if (hasGoals) {
      const meta = goalsByCode?.get(row.id) ?? null;
      extra.push(meta !== null && meta > 0 ? pct((venda / meta) * 100) : null);
    }
    if (tabelaIdx >= 0) {
      const tabela = num(row.cells[tabelaIdx]);
      const desc = tabela > 0 ? ((venda - tabela) / tabela) * 100 : 0;
      extra.push(pct(desc));
    }

    if (costIdx < 0) {
      acum += part;
      extra.push(pct(acum));
      return { ...row, cells: [...row.cells, ...extra] };
    }
    const custo = num(row.cells[costIdx]);
    const contrib = venda - custo;
    const lucro = venda > 0 ? (contrib / venda) * 100 : 0;
    const mc = totalContrib > 0 ? (contrib / totalContrib) * 100 : 0;
    acum += mc;
    extra.push(contrib, pct(lucro), pct(mc), pct(acum));
    return { ...row, cells: [...row.cells, ...extra] };
  });

  const columns = [
    ...value.columns,
    ...(countIdx >= 0
      ? [
          {
            key: "avgvalue",
            label: config.countLabel ?? "Vl. médio",
            align: "right" as const,
            unit: "currency" as const,
          },
        ]
      : []),
    ...(hasGoals
      ? [
          {
            key: "meta",
            label: "Vl.meta",
            align: "right" as const,
            unit: "currency" as const,
          },
        ]
      : []),
    { key: "part", label: "% Part.", align: "right" as const },
    ...(hasGoals
      ? [{ key: "metapct", label: "% Meta", align: "right" as const }]
      : []),
    ...(tabelaIdx >= 0
      ? [{ key: "desc", label: "% Desc", align: "right" as const }]
      : []),
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
