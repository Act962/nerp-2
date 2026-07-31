import "server-only";
import type { OracleQueryConfig } from "@/features/dashboard-widgets/lib/oracle-query-config";
import { loadOracleConfig } from "../connectors";
import { type OracleBinds, withOracleReadOnly } from "../oracle-client";
import { buildWhereConditions, resolveDomainJoin } from "./build-query";
import {
  loadSchemaDictionary,
  resolveTable,
  type SchemaDictionary,
} from "./dictionary";
import { resolveDetailColumns } from "./detail-columns";
import { assertIdentifier } from "./identifier";
import { quickFilterForColumn } from "./quick-filters";

// Detalhamento: os REGISTROS por trás do número agregado.
//
// A regra que faz isso ser confiável: usa exatamente o mesmo WHERE da consulta
// do widget (buildWhereConditions). Assim, se o card conta 1.490 clientes, são
// esses 1.490 que a listagem pagina — não um recorte parecido.
//
// Diferente do resto do módulo, ESTA consulta bate no Oracle a cada abertura:
// é sob demanda, não vai para snapshot. Por isso paginação no banco (só a
// página pedida trafega) e timeout curto.

const DRILLDOWN_TIMEOUT_MS = 20_000;
const MAX_PAGE_SIZE = 100;

export interface DrilldownPage {
  columns: { key: string; label: string; align: "left" | "right" }[];
  rows: { id: string; cells: (string | number | null)[] }[];
  total: number;
}

function formatCell(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return value;
  return String(value);
}

export async function runOracleDrilldown(
  organizationId: string,
  config: OracleQueryConfig,
  page: number,
  pageSize: number,
): Promise<DrilldownPage> {
  const dictionary: SchemaDictionary =
    await loadSchemaDictionary(organizationId);
  const table = resolveTable(dictionary, config.table);
  // Dono da própria tabela — ver buildOracleQuery.
  const schema = assertIdentifier(table.owner);
  const columns = resolveDetailColumns(table);

  if (columns.length === 0) {
    return { columns: [], rows: [], total: 0 };
  }

  const binds: OracleBinds = {};
  const conditions = buildWhereConditions(table, config, binds);
  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize)));
  const offset = Math.max(0, Math.trunc(page)) * limit;

  // Coluna que é código de domínio (CODCLI, CODUSUR…) sai como NOME, igual ao
  // agrupamento do widget. Sem isso o card dizia "REDECARD…" e o detalhamento
  // por trás dele dizia "27600". Cada join tem alias próprio (D0, D1…) porque
  // a mesma linha pode traduzir cliente E vendedor.
  const joins: string[] = [];
  const selectList = columns
    .map((column, index) => {
      const raw = `T.${column.name}`;
      const domain = quickFilterForColumn(table.name, column.name);
      const joined = domain ? resolveDomainJoin(dictionary, domain) : null;
      if (!joined) return `${raw} AS "C${index}"`;

      const alias = `D${index}`;
      joins.push(
        `LEFT JOIN ${joined.owner}.${joined.table} ${alias} ON ${alias}.${joined.valueColumn} = ${raw}`,
      );
      // COALESCE: registro sem cadastro correspondente continua mostrando o
      // código em vez de virar célula vazia.
      return `COALESCE(${alias}.${joined.labelColumn}, TO_CHAR(${raw})) AS "C${index}"`;
    })
    .join(", ");
  const joinClause = joins.join(" ");

  const oracleConfig = await loadOracleConfig(organizationId);

  const { rows, total } = await withOracleReadOnly(
    oracleConfig,
    async (query) => {
      // Contagem e página na MESMA sessão read-only: as duas enxergam o mesmo
      // snapshot, então o total não "briga" com a página exibida.
      const [countRows, pageRows] = await Promise.all([
        query<{ TOTAL: number }>(
          `SELECT COUNT(*) AS "TOTAL" FROM ${schema}.${table.name} T ${where}`,
          binds,
        ),
        query<Record<string, unknown>>(
          `SELECT ${selectList}
             FROM ${schema}.${table.name} T
             ${joinClause}
             ${where}
            ORDER BY T.${columns[0].name}
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
          binds,
        ),
      ]);
      return { rows: pageRows, total: Number(countRows[0]?.TOTAL ?? 0) };
    },
    { callTimeoutMs: DRILLDOWN_TIMEOUT_MS },
  );

  return {
    columns: columns.map((column, index) => ({
      key: `C${index}`,
      label: column.label,
      align: column.numeric ? ("right" as const) : ("left" as const),
    })),
    rows: rows.map((row, index) => ({
      id: `${offset + index}`,
      cells: columns.map((_, position) => formatCell(row[`C${position}`])),
    })),
    total,
  };
}
