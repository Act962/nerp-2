import "server-only";
import {
  type OracleQueryConfig,
  type OracleQueryFilter,
  resolveDatePreset,
} from "@/features/dashboard-widgets/lib/oracle-query-config";
import type { OracleBinds } from "../oracle-client";
import {
  resolveColumn,
  resolveTable,
  type SchemaDictionary,
  type TableInfo,
} from "./dictionary";
import { assertIdentifier } from "./identifier";
import { type QuickFilterDef, quickFilterForColumn } from "./quick-filters";

// Montagem da SQL a partir da config do montador.
//
// Duas regras inegociáveis, ambas visíveis no código abaixo:
//
//  1. IDENTIFICADOR nunca vem do usuário. Tudo que é interpolado passou por
//     resolveTable/resolveColumn, ou seja, é a string canônica que o dicionário
//     do Oracle devolveu. O texto digitado só serviu de chave de busca.
//  2. VALOR nunca é interpolado — sempre bind (`:dtStart`, `:f0v0`…). Além da
//     segurança, é o que faz o Oracle reaproveitar o plano no shared pool em
//     vez de hard-parse a cada variação de filtro.
//
// E uma regra de performance: coluna indexada NUNCA entra dentro de função no
// WHERE. O filtro de data sai como `col >= :a AND col < :b` na coluna crua —
// um `TRUNC(col) BETWEEN …` desligaria o índice silenciosamente. TRUNC só
// aparece no GROUP BY, onde não custa índice.

export interface BuiltQuery {
  sql: string;
  binds: OracleBinds;
  /** Rótulo da coluna de agrupamento, quando existe. */
  groupLabel: string | null;
  measureLabels: string[];
}

const AGGREGATION_SQL: Record<string, (column: string) => string> = {
  SUM: (column) => `SUM(${column})`,
  COUNT: (column) => `COUNT(${column})`,
  COUNT_DISTINCT: (column) => `COUNT(DISTINCT ${column})`,
  AVG: (column) => `AVG(${column})`,
  MIN: (column) => `MIN(${column})`,
  MAX: (column) => `MAX(${column})`,
};

// Tabelas em que CONDVENDA é realmente preenchida.
//
// Medido neste cliente: em PCPEDC (cabeçalho do pedido) CONDVENDA vem
// populada — 10.560 pedidos com `1` em 30 dias, mais alguns `10`/`5`. Já em
// PCPEDI (itens) a coluna existe e até é indexada, mas é 100% NULL: aplicar
// `CONDVENDA = 1` ali zerava o resultado inteiro EM SILÊNCIO (foi assim que o
// modelo "Produtos mais vendidos" voltou 0 linhas).
//
// Por isso o recorte é por tabela: onde a condição de venda não existe de
// fato, POSICAO sozinha define o que é venda válida.
const CONDVENDA_TABLES = new Set(["PCPEDC"]);

// Semântica de venda do Winthor, alinhada com o conector curado
// (connectors/winthor.ts) para os números BATEREM com o ranking.
function salesFilterSql(
  table: TableInfo,
  mode: OracleQueryConfig["salesFilter"],
): string | null {
  if (!mode || mode === "none") return null;
  if (!table.columns.has("POSICAO")) return null;

  const conditions: string[] = [];
  if (CONDVENDA_TABLES.has(table.name) && table.columns.has("CONDVENDA")) {
    conditions.push("T.CONDVENDA = 1");
  }
  conditions.push(mode === "invoiced" ? "T.POSICAO = 'F'" : "T.POSICAO <> 'C'");
  return conditions.join(" AND ");
}

/**
 * Valida a tabela de domínio de um atalho contra o dicionário. Se o cliente
 * não tiver a tabela/coluna (Winthor varia entre versões), devolve null e o
 * agrupamento cai no código cru em vez de quebrar a consulta.
 */
function resolveDomainJoin(
  dictionary: SchemaDictionary,
  definition: QuickFilterDef,
): { table: string; valueColumn: string; labelColumn: string } | null {
  try {
    const domain = resolveTable(dictionary, definition.domain.table);
    return {
      table: domain.name,
      valueColumn: resolveColumn(domain, definition.domain.valueColumn).name,
      labelColumn: resolveColumn(domain, definition.domain.labelColumn).name,
    };
  } catch {
    return null;
  }
}

function filterSql(
  columnName: string,
  filter: OracleQueryFilter,
  index: number,
  binds: OracleBinds,
): string {
  const column = `T.${columnName}`;
  const bindName = (position: number) => `f${index}v${position}`;

  switch (filter.operator) {
    case "isNull":
      return `${column} IS NULL`;
    case "notNull":
      return `${column} IS NOT NULL`;
    case "in": {
      const names = filter.values.map((value, position) => {
        binds[bindName(position)] = value;
        return `:${bindName(position)}`;
      });
      return `${column} IN (${names.join(", ")})`;
    }
    case "between": {
      binds[bindName(0)] = filter.values[0];
      binds[bindName(1)] = filter.values[1];
      return `${column} BETWEEN :${bindName(0)} AND :${bindName(1)}`;
    }
    case "contains": {
      // UPPER() na coluna desliga índice — o pré-voo avisa; é o preço de
      // busca por trecho de texto.
      binds[bindName(0)] = `%${String(filter.values[0]).toUpperCase()}%`;
      return `UPPER(${column}) LIKE :${bindName(0)}`;
    }
    default: {
      const operators = {
        eq: "=",
        neq: "<>",
        gt: ">",
        gte: ">=",
        lt: "<",
        lte: "<=",
      } as const;
      binds[bindName(0)] = filter.values[0];
      return `${column} ${operators[filter.operator]} :${bindName(0)}`;
    }
  }
}

/**
 * Condições do WHERE — período, semântica de venda e filtros do usuário.
 *
 * Extraído porque o detalhamento (drill-down) precisa EXATAMENTE do mesmo
 * recorte da consulta agregada: é o que garante que os 1.490 registros
 * listados sejam os mesmos 1.490 que o card contou.
 */
export function buildWhereConditions(
  table: TableInfo,
  config: OracleQueryConfig,
  binds: OracleBinds,
): string[] {
  const conditions: string[] = [];

  if (config.dateFilter) {
    const column = resolveColumn(table, config.dateFilter.column);
    const { from, to } = resolveDatePreset(config.dateFilter.preset);
    // Coluna crua nos dois lados: é isso que permite index range scan.
    conditions.push(
      `T.${column.name} >= :dtStart AND T.${column.name} < :dtEnd`,
    );
    binds.dtStart = from;
    binds.dtEnd = to;
  }

  const sales = salesFilterSql(table, config.salesFilter);
  if (sales) conditions.push(sales);

  config.filters.forEach((filter, index) => {
    const column = resolveColumn(table, filter.column);
    conditions.push(filterSql(column.name, filter, index, binds));
  });

  return conditions;
}

export function buildOracleQuery(
  dictionary: SchemaDictionary,
  config: OracleQueryConfig,
): BuiltQuery {
  const schema = assertIdentifier(dictionary.schema);
  const table = resolveTable(dictionary, config.table);
  const binds: OracleBinds = {};

  // --- SELECT ---
  const selectParts: string[] = [];
  let groupExpression: string | null = null;
  let groupLabel: string | null = null;
  let joinClause: string | null = null;
  // Quantas colunas do SELECT são de agrupamento — define a posição ordinal da
  // primeira medida no ORDER BY.
  let groupSelectCount = 0;

  if (config.groupBy.kind === "date") {
    const column = resolveColumn(table, config.groupBy.column);
    const trunc =
      config.groupBy.granularity === "month"
        ? `TRUNC(T.${column.name}, 'MM')`
        : `TRUNC(T.${column.name})`;
    const format =
      config.groupBy.granularity === "month" ? "YYYY-MM" : "YYYY-MM-DD";
    selectParts.push(`TO_CHAR(${trunc}, '${format}') AS "G"`);
    groupExpression = trunc;
    groupLabel = column.name;
    groupSelectCount = 1;
  } else if (config.groupBy.kind === "dimension") {
    const column = resolveColumn(table, config.groupBy.column);
    // Agrupar por CODFILIAL/CODUSUR mostraria "1", "2" no widget. Quando a
    // coluna tem tabela de domínio conhecida, traz o nome junto — o código
    // continua como fallback para registro sem cadastro.
    const domain = quickFilterForColumn(table.name, column.name);
    const joined = domain ? resolveDomainJoin(dictionary, domain) : null;

    if (domain && joined) {
      selectParts.push(
        `COALESCE(D.${joined.labelColumn}, TO_CHAR(T.${column.name})) AS "G"`,
      );
      // O código também vem, como identidade: dois cadastros podem ter o mesmo
      // nome fantasia (acontece nas filiais deste cliente) e aí o rótulo
      // sozinho não serve de chave.
      selectParts.push(`TO_CHAR(T.${column.name}) AS "GID"`);
      joinClause = `LEFT JOIN ${schema}.${joined.table} D ON D.${joined.valueColumn} = T.${column.name}`;
      groupExpression = `T.${column.name}, D.${joined.labelColumn}`;
      groupLabel = domain.label;
      groupSelectCount = 2;
    } else {
      selectParts.push(`TO_CHAR(T.${column.name}) AS "G"`);
      groupExpression = `T.${column.name}`;
      groupLabel = column.name;
      groupSelectCount = 1;
    }
  }

  const measureLabels: string[] = [];
  config.measures.forEach((measure, index) => {
    const target =
      measure.column === null
        ? "*"
        : `T.${resolveColumn(table, measure.column).name}`;
    const build = AGGREGATION_SQL[measure.aggregation];
    selectParts.push(`${build(target)} AS "M${index}"`);
    measureLabels.push(measure.label);
  });

  // --- WHERE ---
  const conditions = buildWhereConditions(table, config, binds);

  // --- ORDER BY ---
  // Posicional para não repetir a expressão: 1 = grupo, 2 = primeira medida.
  let orderBy = "";
  if (groupExpression) {
    const measurePosition = groupSelectCount + 1;
    if (config.orderBy === "groupAsc") orderBy = "ORDER BY 1";
    else if (config.orderBy === "measureAsc")
      orderBy = `ORDER BY ${measurePosition} ASC NULLS LAST`;
    else orderBy = `ORDER BY ${measurePosition} DESC NULLS LAST`;
    // Série temporal só faz sentido em ordem cronológica.
    if (config.groupBy.kind === "date") orderBy = "ORDER BY 1";
  }

  const sql = [
    `SELECT ${selectParts.join(", ")}`,
    `FROM ${schema}.${table.name} T`,
    joinClause ?? "",
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    groupExpression ? `GROUP BY ${groupExpression}` : "",
    orderBy,
    // Guarda de payload/renderização (NÃO de carga no ERP — a agregação varre
    // o conjunto filtrado de qualquer jeito). Interpolado porque FETCH FIRST
    // com bind não é confiável entre versões; o valor é inteiro clampado pelo
    // schema Zod (1..200).
    groupExpression
      ? `FETCH FIRST ${Math.min(200, Math.max(1, Math.trunc(config.limit)))} ROWS ONLY`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { sql, binds, groupLabel, measureLabels };
}
