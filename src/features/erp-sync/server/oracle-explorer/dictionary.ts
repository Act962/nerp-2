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
  /** Dono da tabela. Nem tudo mora no schema principal do cliente: o WMS do
   * Winthor fica num schema próprio (SWMS), e é ele que precisa ir para a SQL —
   * qualificar tudo com o schema principal gerava "table or view does not
   * exist" para essas tabelas. */
  owner: string;
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
  OWNER: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
}
interface TableRow {
  OWNER: string;
  TABLE_NAME: string;
  NUM_ROWS: number | null;
}
interface IndexRow {
  TABLE_OWNER: string;
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
      // Schemas a varrer. Não basta o principal: o WMS do Winthor mora em
      // schema próprio (SWMS) e o usuário costuma ter GRANT lá. `all_users`
      // marca o que é do próprio Oracle (SYS, MDSYS, XDB…) — descartamos isso
      // para não encher o dicionário com 130 tabelas de catálogo interno.
      // Em banco sem essa coluna (Oracle antigo) cai no schema principal.
      let owners = [schema];
      try {
        const rows = await query<{ USERNAME: string }>(
          `SELECT username AS "USERNAME" FROM all_users WHERE oracle_maintained = 'N'`,
        );
        const found = rows
          .map((row) => row.USERNAME)
          .filter((name) => name !== schema);
        // ALL_TABLES já filtra por permissão — schema sem GRANT não devolve
        // linha nenhuma, então listar a mais aqui não custa.
        if (found.length > 0) owners = [schema, ...found];
      } catch {
        // Sem ORACLE_MAINTAINED: segue só com o schema principal.
      }
      const ownerBinds: Record<string, string> = {};
      const ownerList = owners
        .map((owner, index) => {
          ownerBinds[`o${index}`] = owner;
          return `:o${index}`;
        })
        .join(", ");

      // SEQUENCIAL, não Promise.all: as três rodam na MESMA conexão, então o
      // driver as serializa de qualquer jeito — o paralelismo era ilusório. Pior:
      // `callTimeout` conta desde o disparo, então a 3ª herdava a espera das
      // outras duas e podia estourar sozinha. Uma de cada vez, cada uma com o
      // orçamento inteiro.
      //
      // `owner` é VALOR aqui (comparado como string), então vai como bind.
      const tables = await query<TableRow>(
        `SELECT owner AS "OWNER", table_name AS "TABLE_NAME", num_rows AS "NUM_ROWS"
           FROM all_tables
          WHERE owner IN (${ownerList})`,
        ownerBinds,
      );
      const columns = await query<ColumnRow>(
        `SELECT c.owner AS "OWNER",
                c.table_name AS "TABLE_NAME",
                c.column_name AS "COLUMN_NAME",
                c.data_type AS "DATA_TYPE"
           FROM all_tab_columns c
           JOIN all_tables t
             ON t.owner = c.owner AND t.table_name = c.table_name
          WHERE c.owner IN (${ownerList})
          ORDER BY c.owner, c.table_name, c.column_id`,
        ownerBinds,
      );
      const indexes = await query<IndexRow>(
        `SELECT table_owner AS "TABLE_OWNER",
                table_name AS "TABLE_NAME",
                column_name AS "COLUMN_NAME",
                MIN(column_position) AS "COLUMN_POSITION"
           FROM all_ind_columns
          WHERE table_owner IN (${ownerList})
          GROUP BY table_owner, table_name, column_name`,
        ownerBinds,
      );
      return { tables, columns, indexes };
    },
    // Caminho frio, uma vez por hora: o catálogo leva ~5s com o ERP ocioso, mas
    // no horário comercial a mesma leitura passa de 30s. Prazo generoso aqui é
    // mais barato que devolver erro e fazer o usuário recarregar.
    { callTimeoutMs: 90_000 },
  );

  // Chaves qualificadas por dono: com vários schemas, "PCEST" sozinho não
  // identifica mais uma tabela.
  const bestPosition = new Map<string, number>();
  for (const row of indexes) {
    bestPosition.set(
      `${row.TABLE_OWNER}.${row.TABLE_NAME}.${row.COLUMN_NAME}`,
      Number(row.COLUMN_POSITION),
    );
  }

  const rowCountByTable = new Map<string, number | null>();
  for (const row of tables) {
    rowCountByTable.set(
      `${row.OWNER}.${row.TABLE_NAME}`,
      row.NUM_ROWS === null ? null : Number(row.NUM_ROWS),
    );
  }

  const dictionary: SchemaDictionary = { schema, tables: new Map() };

  for (const row of columns) {
    // Lixo do dicionário: lixeira do Oracle, tabelas de sistema de ferramenta.
    if (row.TABLE_NAME.startsWith("BIN$")) continue;
    if (row.TABLE_NAME === "SQLN_EXPLAIN_PLAN") continue;
    const qualified = `${row.OWNER}.${row.TABLE_NAME}`;
    if (!rowCountByTable.has(qualified)) continue;

    let table = dictionary.tables.get(row.TABLE_NAME);
    // O mapa continua indexado só pelo NOME — é assim que as configs salvas
    // referenciam a tabela ("PCPEDC"), e reescrever todas para incluir o dono
    // quebraria os widgets já criados. Se dois schemas trouxerem o mesmo nome,
    // o principal vence; o outro fica inacessível, o que é melhor do que
    // resolver para uma tabela homônima sem o usuário perceber.
    if (table && table.owner !== row.OWNER) {
      if (table.owner === schema) continue;
      if (row.OWNER !== schema) continue;
      table = undefined; // principal chegou depois: substitui o homônimo.
    }
    if (!table) {
      table = {
        name: row.TABLE_NAME,
        owner: row.OWNER,
        rowCount: rowCountByTable.get(qualified) ?? null,
        columns: new Map(),
      };
      dictionary.tables.set(row.TABLE_NAME, table);
    }

    const position = bestPosition.get(`${qualified}.${row.COLUMN_NAME}`);
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

// Single-flight por organização. Sem isto, um dashboard com N widgets Oracle
// abrindo com o cache frio (todo restart do servidor) dispara N leituras
// COMPLETAS do catálogo em paralelo — N conexões, cada uma repetindo a mesma
// varredura de ALL_TAB_COLUMNS. Era isso que derrubava tudo em "NJS-123: call
// timeout": não o volume (4 mil linhas), e sim a concorrência contra si mesmo.
const inFlight = new Map<string, Promise<SchemaDictionary>>();

export async function loadSchemaDictionary(
  organizationId: string,
): Promise<SchemaDictionary> {
  const cached = cache.get(organizationId);
  if (cached && cached.expiresAt > Date.now()) return cached.dictionary;

  const running = inFlight.get(organizationId);
  if (running) return running;

  const promise = fetchDictionary(organizationId)
    .then((dictionary) => {
      cache.set(organizationId, {
        expiresAt: Date.now() + DICTIONARY_TTL_MS,
        dictionary,
      });
      return dictionary;
    })
    .catch((error) => {
      // Contorno de tabela/índice praticamente não muda; um catálogo de 1h atrás
      // continua correto. Se o ERP está sobrecarregado, servir o vencido mantém
      // o dashboard de pé em vez de trocar tudo por uma tela de erro — só quem
      // nunca carregou o dicionário é que realmente falha.
      if (cached) return cached.dictionary;
      throw error;
    })
    .finally(() => {
      inFlight.delete(organizationId);
    });

  inFlight.set(organizationId, promise);
  return promise;
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
