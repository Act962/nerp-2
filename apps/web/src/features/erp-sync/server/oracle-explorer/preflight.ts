import "server-only";
import type { OracleQueryConfig } from "@/features/dashboard-widgets/lib/oracle-query-config";
import {
  resolveColumn,
  resolveTable,
  type SchemaDictionary,
  type TableInfo,
} from "./dictionary";

// Pré-voo: decide ANTES de executar se a consulta é aceitável para o ERP de
// produção do cliente.
//
// Por que estimativa por estatística e não EXPLAIN PLAN: o EXPLAIN grava na
// PLAN_TABLE, e a sessão é `SET TRANSACTION READ ONLY` — seria recusado pelo
// banco (e pelo nosso allowlist). `ALL_TABLES.NUM_ROWS` + posição no índice é
// o equivalente puramente de leitura.

/** Acima disso, varredura completa é inaceitável: exige data indexada. */
const LARGE_TABLE_ROWS = 1_000_000;
/** Acima disso avisamos, mas não bloqueamos. */
const MEDIUM_TABLE_ROWS = 100_000;

export interface PreflightResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function isLarge(table: TableInfo): boolean {
  return (table.rowCount ?? 0) > LARGE_TABLE_ROWS;
}

export function preflightOracleQuery(
  dictionary: SchemaDictionary,
  config: OracleQueryConfig,
): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let table: TableInfo;
  try {
    table = resolveTable(dictionary, config.table);
  } catch (error) {
    return { ok: false, errors: [(error as Error).message], warnings };
  }

  const large = isLarge(table);
  const rows = table.rowCount ?? 0;

  // --- Filtro de data: a guarda principal contra varredura ---
  if (config.dateFilter) {
    try {
      const column = resolveColumn(table, config.dateFilter.column);
      if (column.role !== "date") {
        errors.push(`"${column.name}" não é uma coluna de data.`);
      } else if (large && !column.leadingIndex) {
        errors.push(
          `"${column.name}" não é a primeira coluna de nenhum índice — filtrar por ela em ${table.name} (${rows.toLocaleString("pt-BR")} linhas) varreria a tabela inteira. Escolha uma coluna de data indexada.`,
        );
      } else if (!column.leadingIndex && rows > MEDIUM_TABLE_ROWS) {
        warnings.push(
          `"${column.name}" não tem índice como primeira coluna; a consulta pode ficar lenta.`,
        );
      }
    } catch (error) {
      errors.push((error as Error).message);
    }
  } else if (large) {
    errors.push(
      `${table.name} tem ${rows.toLocaleString("pt-BR")} linhas — defina um período para a consulta não varrer a tabela inteira.`,
    );
  } else if (rows > MEDIUM_TABLE_ROWS) {
    warnings.push(
      `${table.name} tem ${rows.toLocaleString("pt-BR")} linhas; um período deixaria a consulta mais rápida.`,
    );
  }

  // --- Medidas ---
  for (const measure of config.measures) {
    if (measure.column === null) {
      if (measure.aggregation !== "COUNT") {
        errors.push(
          `A operação ${measure.aggregation} precisa de uma coluna; só a contagem funciona sem.`,
        );
      }
      continue;
    }
    try {
      const column = resolveColumn(table, measure.column);
      if (
        measure.aggregation !== "COUNT" &&
        measure.aggregation !== "COUNT_DISTINCT" &&
        measure.aggregation !== "MIN" &&
        measure.aggregation !== "MAX" &&
        column.role === "dimension" &&
        !/^NUMBER|^FLOAT/.test(column.dataType)
      ) {
        errors.push(
          `"${column.name}" não é numérica — não dá para calcular ${measure.aggregation}.`,
        );
      }
    } catch (error) {
      errors.push((error as Error).message);
    }
    // COUNT_DISTINCT força ordenação/hash do conjunto inteiro; nas tabelas de
    // milhões de linhas estoura o timeout mesmo com filtro de data.
    if (measure.aggregation === "COUNT_DISTINCT" && large) {
      errors.push(
        `Contagem distinta não é permitida em ${table.name} (${rows.toLocaleString("pt-BR")} linhas) — o custo é alto demais para o ERP.`,
      );
    }
  }

  // --- Agrupamento ---
  if (config.groupBy.kind !== "none") {
    try {
      const column = resolveColumn(table, config.groupBy.column);
      if (config.groupBy.kind === "date" && column.role !== "date") {
        errors.push(`"${column.name}" não é uma coluna de data.`);
      }
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  // --- Filtros de dimensão ---
  for (const filter of config.filters) {
    try {
      const column = resolveColumn(table, filter.column);
      if (!column.indexed && large) {
        warnings.push(
          `"${column.name}" não tem índice; ela filtra o resultado mas não reduz o que o banco varre.`,
        );
      }
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
