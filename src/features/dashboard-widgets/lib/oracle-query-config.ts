import z from "zod";

// Config de uma consulta customizada ao Oracle, guardada em
// `DashboardWidget.options.oracle`.
//
// Arquivo PURO de propósito (sem `server-only`): o mesmo schema valida no
// handler e dirige o formulário. A duplicação que existe em widget-value.ts só
// é necessária porque aquele lado é server-only — aqui não se aplica.
//
// Nada aqui vira SQL diretamente: `table`/`column` são apenas CHAVES DE BUSCA
// no dicionário do schema; quem é interpolado é sempre o nome canônico que
// voltou do banco (ver oracle-explorer/dictionary.ts).

export const ORACLE_CUSTOM_KEY = "oracle.custom";

export const AGGREGATIONS = [
  "SUM",
  "COUNT",
  "COUNT_DISTINCT",
  "AVG",
  "MIN",
  "MAX",
] as const;
export type OracleAggregation = (typeof AGGREGATIONS)[number];

export const AGGREGATION_LABEL: Record<OracleAggregation, string> = {
  SUM: "Soma",
  COUNT: "Contagem",
  COUNT_DISTINCT: "Contagem distinta",
  AVG: "Média",
  MIN: "Mínimo",
  MAX: "Máximo",
};

export const FILTER_OPERATORS = [
  "eq",
  "neq",
  "in",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "contains",
  "isNull",
  "notNull",
] as const;
export type OracleFilterOperator = (typeof FILTER_OPERATORS)[number];

export const OPERATOR_LABEL: Record<OracleFilterOperator, string> = {
  eq: "igual a",
  neq: "diferente de",
  in: "é um de",
  gt: "maior que",
  gte: "maior ou igual a",
  lt: "menor que",
  lte: "menor ou igual a",
  between: "entre",
  contains: "contém",
  isNull: "está vazio",
  notNull: "está preenchido",
};

/** Quantos valores cada operador exige. `null` = intervalo aberto (IN). */
const VALUE_ARITY: Record<OracleFilterOperator, number | null> = {
  eq: 1,
  neq: 1,
  in: null,
  gt: 1,
  gte: 1,
  lt: 1,
  lte: 1,
  between: 2,
  contains: 1,
  isNull: 0,
  notNull: 0,
};

/** Acima disso o plano do Oracle degrada; recusamos em vez de deixar arrastar. */
export const MAX_IN_VALUES = 100;

export const DATE_PRESETS = [
  "today",
  "last7",
  "currentMonth",
  "last30",
  "last90",
  "currentYear",
  "last12Months",
  // Janelas para FRENTE — necessárias para vencimento/entrega, que perguntam
  // "o que vai acontecer", não "o que aconteceu".
  "next30",
  "next60",
  "next90",
  "overdue",
] as const;
export type OracleDatePreset = (typeof DATE_PRESETS)[number];

export const DATE_PRESET_LABEL: Record<OracleDatePreset, string> = {
  today: "Hoje",
  last7: "Últimos 7 dias",
  currentMonth: "Mês atual",
  last30: "Últimos 30 dias",
  last90: "Últimos 90 dias",
  currentYear: "Ano atual",
  last12Months: "Últimos 12 meses",
  next30: "Próximos 30 dias",
  next60: "Próximos 60 dias",
  next90: "Próximos 90 dias",
  overdue: "Já vencido",
};

const filterSchema = z
  .object({
    column: z.string().min(1),
    operator: z.enum(FILTER_OPERATORS),
    values: z.array(z.union([z.string(), z.number()])).default([]),
  })
  .superRefine((filter, ctx) => {
    const arity = VALUE_ARITY[filter.operator];
    if (arity === null) {
      if (filter.values.length < 1) {
        ctx.addIssue({ code: "custom", message: "Informe ao menos um valor." });
      }
      if (filter.values.length > MAX_IN_VALUES) {
        ctx.addIssue({
          code: "custom",
          message: `No máximo ${MAX_IN_VALUES} valores por filtro.`,
        });
      }
      return;
    }
    if (filter.values.length !== arity) {
      ctx.addIssue({
        code: "custom",
        message:
          arity === 0
            ? "Este operador não usa valor."
            : `Este operador exige ${arity} valor(es).`,
      });
    }
  });

export const oracleQueryConfigSchema = z.object({
  version: z.literal(1).default(1),
  table: z.string().min(1),
  measures: z
    .array(
      z.object({
        aggregation: z.enum(AGGREGATIONS),
        // null só faz sentido em COUNT (vira COUNT(*)).
        column: z.string().min(1).nullable(),
        label: z.string().min(1).max(40),
        unit: z.enum(["currency", "number", "percent"]).default("number"),
      }),
    )
    .min(1)
    .max(6),
  groupBy: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("none") }),
      z.object({ kind: z.literal("dimension"), column: z.string().min(1) }),
      z.object({
        kind: z.literal("date"),
        column: z.string().min(1),
        granularity: z.enum(["day", "month"]),
      }),
    ])
    .default({ kind: "none" }),
  dateFilter: z
    .object({ column: z.string().min(1), preset: z.enum(DATE_PRESETS) })
    .nullable()
    .default(null),
  filters: z.array(filterSchema).max(8).default([]),
  // Semântica de venda do Winthor. Default "valid" faz o número BATER com o
  // ranking (que usa condvenda = 1 AND posicao <> 'C'); "none" é permitido mas
  // a UI avisa que diverge.
  salesFilter: z.enum(["valid", "invoiced", "none"]).nullable().default(null),
  orderBy: z
    .enum(["measureDesc", "measureAsc", "groupAsc"])
    .default("measureDesc"),
  limit: z.number().int().min(1).max(200).default(20),
});

export type OracleQueryConfig = z.infer<typeof oracleQueryConfigSchema>;
export type OracleQueryFilter = OracleQueryConfig["filters"][number];
export type OracleQueryMeasure = OracleQueryConfig["measures"][number];

export type WidgetDisplayTypeName = "STAT" | "CHART" | "LIST" | "MAP" | "TABLE";

/**
 * Formas de exibição compatíveis com a consulta montada.
 *
 * `displayType` continua sendo coluna no banco (é o eixo de dispatch da grid e
 * permite alternar lista/gráfico sobre a mesma consulta) — esta função é a
 * VALIDAÇÃO desse par, não a fonte dele.
 */
export function allowedDisplayTypes(
  config: Pick<OracleQueryConfig, "measures" | "groupBy">,
): WidgetDisplayTypeName[] {
  if (config.measures.length > 1) return ["TABLE"];
  if (config.groupBy.kind === "none") return ["STAT"];
  if (config.groupBy.kind === "date") return ["CHART", "LIST", "TABLE"];
  return ["LIST", "CHART", "TABLE"];
}

// Códigos de dimensão mais comuns do Winthor, para o nome sugerido não sair
// como "Receita por CODFILIAL". Só cobre os frequentes — o resto cai no nome
// da coluna mesmo, que é melhor que nada.
const DIMENSION_LABEL: Record<string, string> = {
  CODFILIAL: "Filial",
  CODUSUR: "Vendedor",
  CODSUPERVISOR: "Supervisor",
  CODCLI: "Cliente",
  CODPROD: "Produto",
  CODMARCA: "Marca",
  CODEPTO: "Departamento",
  CODSEC: "Seção",
  CODFORNEC: "Fornecedor",
  CODOPER: "Operação",
  POSICAO: "Situação",
  CODCOB: "Cobrança",
};

/**
 * Nome sugerido para o widget a partir da consulta montada — sem isso todo
 * widget Oracle nasceria como "Consulta personalizada" e ficaria impossível
 * distinguir dois deles no dashboard.
 */
export function describeOracleQuery(
  config: Pick<OracleQueryConfig, "measures" | "groupBy">,
): string | null {
  const first = config.measures[0];
  if (!first) return null;

  const measures =
    config.measures.length > 1
      ? config.measures.map((measure) => measure.label).join(" · ")
      : first.label;

  if (config.groupBy.kind === "none") return measures;
  if (config.groupBy.kind === "date") {
    return `${measures} por ${config.groupBy.granularity === "month" ? "mês" : "dia"}`;
  }
  const column = config.groupBy.column;
  return `${measures} por ${DIMENSION_LABEL[column] ?? column}`;
}

/** Janela de datas de um preset. Fim é EXCLUSIVO (usado com `<`). */
export function resolveDatePreset(
  preset: OracleDatePreset,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endExclusive = new Date(startOfToday);
  endExclusive.setDate(endExclusive.getDate() + 1);

  const daysAgo = (days: number) => {
    const date = new Date(startOfToday);
    date.setDate(date.getDate() - days);
    return date;
  };

  const daysAhead = (days: number) => {
    const date = new Date(startOfToday);
    date.setDate(date.getDate() + days);
    return date;
  };

  switch (preset) {
    case "today":
      return { from: startOfToday, to: endExclusive };
    case "last7":
      return { from: daysAgo(6), to: endExclusive };
    case "last30":
      return { from: daysAgo(29), to: endExclusive };
    case "last90":
      return { from: daysAgo(89), to: endExclusive };
    case "currentMonth":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: endExclusive,
      };
    case "currentYear":
      return { from: new Date(now.getFullYear(), 0, 1), to: endExclusive };
    case "last12Months": {
      const from = new Date(startOfToday);
      from.setMonth(from.getMonth() - 12);
      return { from, to: endExclusive };
    }
    // Janelas futuras: começam HOJE (inclusive) e vão até o fim do período.
    case "next30":
      return { from: startOfToday, to: daysAhead(31) };
    case "next60":
      return { from: startOfToday, to: daysAhead(61) };
    case "next90":
      return { from: startOfToday, to: daysAhead(91) };
    // "Já vencido" é tudo antes de hoje. O limite inferior existe só para o
    // predicado continuar sendo um range fechado (e usar índice); nenhuma data
    // de negócio do Winthor é anterior a isso.
    case "overdue":
      return { from: new Date(1900, 0, 1), to: startOfToday };
  }
}
