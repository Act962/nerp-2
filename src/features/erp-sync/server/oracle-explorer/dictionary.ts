import "server-only";
import { loadOracleConfig } from "../connectors";
import { withOracleReadOnly } from "../oracle-client";
import { assertIdentifier } from "./identifier";

// Dicionário do schema do cliente: quais tabelas/colunas existem e quais
// colunas são pesquisáveis por índice.
//
// É a peça central de segurança E de performance:
//  - segurança: o nome que o usuário escolhe é só CHAVE DE BUSCA aqui; o que
//    vai para a SQL é a string canônica que voltou do banco. Entrada do
//    usuário nunca é interpolada.
//  - performance: `leadingIndex` diz se um filtro naquela coluna vira index
//    range scan ou varredura completa — é o que sustenta o pré-voo.

export type ColumnRole = "measure" | "dimension" | "date";

export interface ColumnInfo {
  name: string;
  dataType: string;
  role: ColumnRole;
  /** Aparece em algum índice (qualquer posição). */
  indexed: boolean;
  /** É a PRIMEIRA coluna de algum índice — o que realmente permite range scan. */
  leadingIndex: boolean;
}

export interface TableInfo {
  name: string;
  rowCount: number | null;
  columns: Map<string, ColumnInfo>;
}

export interface SchemaDictionary {
  schema: string;
  tables: Map<string, TableInfo>;
}

// Prefixos de coluna numérica que representam medida no Winthor (valor,
// quantidade, total, peso, percentual). O resto de NUMBER costuma ser código
// de domínio (CODCLI, CODUSUR…), que é dimensão, não coisa de somar.
const MEASURE_PREFIXES = ["VL", "QT", "TOT", "PESO", "PERC"];

function classifyColumn(name: string, dataType: string): ColumnRole {
  if (dataType.startsWith("DATE") || dataType.startsWith("TIMESTAMP")) {
    return "date";
  }
  if (dataType === "NUMBER" || dataType === "FLOAT") {
    return MEASURE_PREFIXES.some((prefix) => name.startsWith(prefix))
      ? "measure"
      : "dimension";
  }
  return "dimension";
}

interface ColumnRow {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
}
interface TableRow {
  TABLE_NAME: string;
  NUM_ROWS: number | null;
}
interface IndexRow {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  COLUMN_POSITION: number;
}

const DICTIONARY_TTL_MS = 60 * 60 * 1000;

// Cache por processo. Contornos de tabela/índice não mudam em produção;
// 1h é conservador. Numa Vercel com várias instâncias cada uma tem a sua —
// aceitável, é leitura de dicionário, não de negócio (mesma limitação
// assumida no rate limiter de tradegram-public/identify-product.ts).
const cache = new Map<
  string,
  { expiresAt: number; dictionary: SchemaDictionary }
>();

async function fetchDictionary(
  organizationId: string,
): Promise<SchemaDictionary> {
  const config = await loadOracleConfig(organizationId);
  const schema = assertIdentifier(config.schema);

  const { tables, columns, indexes } = await withOracleReadOnly(
    config,
    async (query) => {
      // `owner` é VALOR aqui (comparado como string), então vai como bind.
      const [tables, columns, indexes] = await Promise.all([
        query<TableRow>(
          `SELECT table_name AS "TABLE_NAME", num_rows AS "NUM_ROWS"
             FROM all_tables
            WHERE owner = :owner`,
          { owner: schema },
        ),
        query<ColumnRow>(
          `SELECT c.table_name AS "TABLE_NAME",
                  c.column_name AS "COLUMN_NAME",
                  c.data_type AS "DATA_TYPE"
             FROM all_tab_columns c
             JOIN all_tables t
               ON t.owner = c.owner AND t.table_name = c.table_name
            WHERE c.owner = :owner
            ORDER BY c.table_name, c.column_id`,
          { owner: schema },
        ),
        query<IndexRow>(
          `SELECT table_name AS "TABLE_NAME",
                  column_name AS "COLUMN_NAME",
                  MIN(column_position) AS "COLUMN_POSITION"
             FROM all_ind_columns
            WHERE table_owner = :owner
            GROUP BY table_name, column_name`,
          { owner: schema },
        ),
      ]);
      return { tables, columns, indexes };
    },
    { callTimeoutMs: 30_000 },
  );

  // Índice por (tabela, coluna) → melhor posição, para saber quem é líder.
  const bestPosition = new Map<string, number>();
  for (const row of indexes) {
    bestPosition.set(
      `${row.TABLE_NAME}.${row.COLUMN_NAME}`,
      Number(row.COLUMN_POSITION),
    );
  }

  const rowCountByTable = new Map<string, number | null>();
  for (const row of tables) {
    rowCountByTable.set(
      row.TABLE_NAME,
      row.NUM_ROWS === null ? null : Number(row.NUM_ROWS),
    );
  }

  const dictionary: SchemaDictionary = { schema, tables: new Map() };

  for (const row of columns) {
    // Lixo do dicionário: lixeira do Oracle, tabelas de sistema de ferramenta.
    if (row.TABLE_NAME.startsWith("BIN$")) continue;
    if (row.TABLE_NAME === "SQLN_EXPLAIN_PLAN") continue;
    if (!rowCountByTable.has(row.TABLE_NAME)) continue;

    let table = dictionary.tables.get(row.TABLE_NAME);
    if (!table) {
      table = {
        name: row.TABLE_NAME,
        rowCount: rowCountByTable.get(row.TABLE_NAME) ?? null,
        columns: new Map(),
      };
      dictionary.tables.set(row.TABLE_NAME, table);
    }

    const position = bestPosition.get(`${row.TABLE_NAME}.${row.COLUMN_NAME}`);
    table.columns.set(row.COLUMN_NAME, {
      name: row.COLUMN_NAME,
      dataType: row.DATA_TYPE,
      role: classifyColumn(row.COLUMN_NAME, row.DATA_TYPE),
      indexed: position !== undefined,
      leadingIndex: position === 1,
    });
  }

  return dictionary;
}

export async function loadSchemaDictionary(
  organizationId: string,
): Promise<SchemaDictionary> {
  const cached = cache.get(organizationId);
  if (cached && cached.expiresAt > Date.now()) return cached.dictionary;

  const dictionary = await fetchDictionary(organizationId);
  cache.set(organizationId, {
    expiresAt: Date.now() + DICTIONARY_TTL_MS,
    dictionary,
  });
  return dictionary;
}

export class UnknownObjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownObjectError";
  }
}

/** Devolve o nome CANÔNICO da tabela — é ele que pode ir para a SQL. */
export function resolveTable(
  dictionary: SchemaDictionary,
  table: string,
): TableInfo {
  const found = dictionary.tables.get(table.trim().toUpperCase());
  if (!found) {
    throw new UnknownObjectError(`Tabela desconhecida: ${table.slice(0, 40)}`);
  }
  return found;
}

/** Devolve a coluna CANÔNICA — é ela que pode ir para a SQL. */
export function resolveColumn(table: TableInfo, column: string): ColumnInfo {
  const found = table.columns.get(column.trim().toUpperCase());
  if (!found) {
    throw new UnknownObjectError(
      `Coluna desconhecida em ${table.name}: ${column.slice(0, 40)}`,
    );
  }
  return found;
}
