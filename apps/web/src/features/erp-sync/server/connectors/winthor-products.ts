import "server-only";

import { assertIdentifier } from "../oracle-explorer/identifier";
import {
  withOracleReadOnly,
  type OracleConfig,
  type OracleQuery,
} from "../oracle-client";
import type { ExternalProductDTO, ExternalProductStockDTO } from "./types";

// Cadastro de PRODUTOS do Winthor.
//
// Arquivo separado do `winthor.ts` de propósito: aquele cuida de vendedores e
// fatos de venda, que rodam a cada 15 minutos. Produto muda pouco e é lido em
// volume (milhares de linhas), então roda só na passada diária e no botão.
//
// A SQL é própria — NÃO passa pelo `build-query.ts` do explorer, que tem teto de
// 200 linhas por ser previsualizador de consulta, não extrator.
//
// ⚠️ `PCPRODUT` e as colunas abaixo são a convenção do Winthor, e o schema varia
// por cliente (é por isso que o dicionário do explorer é dinâmico). Confirme com
// `listTables`/`listColumns` antes de rodar num cliente novo; divergindo, só
// esta SQL muda.

/** Quantas linhas por página. O cursor do driver segura o resto. */
const PAGE_SIZE = 2000;
/** Teto de segurança: cadastro maior que isso indica query errada, não catálogo. */
const MAX_ROWS = 200_000;

interface ProductRow {
  CODPROD: number | string;
  DESCRICAO: string | null;
  CODAUXILIAR: number | string | null;
  UNIDADE: string | null;
  PVENDA: number | null;
  DTEXCLUSAO: Date | null;
  QTUNITCX: number | null;
}

function toDTO(row: ProductRow): ExternalProductDTO {
  return {
    externalCode: String(row.CODPROD),
    name: (row.DESCRICAO ?? "").trim(),
    // Vem como número no Oracle: `String()` para não perder zero à esquerda no
    // caminho, e a normalização final acontece na reconciliação.
    barcode: row.CODAUXILIAR == null ? null : String(row.CODAUXILIAR).trim(),
    unit: row.UNIDADE?.trim() || null,
    salePrice: row.PVENDA == null ? null : Number(row.PVENDA),
    // No Winthor não há coluna booleana de "ativo": produto fora de linha recebe
    // DATA DE EXCLUSÃO. Sem data = ativo.
    isActive: row.DTEXCLUSAO == null,
    unitsPerBox: row.QTUNITCX == null ? null : Number(row.QTUNITCX),
  };
}

/**
 * Lê o cadastro inteiro, em páginas.
 *
 * Paginação por `CODPROD` (chave primária) em vez de OFFSET: com OFFSET o banco
 * relê e descarta as páginas anteriores a cada chamada, o que fica quadrático
 * num cadastro grande.
 */
export async function fetchWinthorProducts(
  config: OracleConfig,
): Promise<ExternalProductDTO[]> {
  const schema = assertIdentifier(config.schema);

  return withOracleReadOnly(config, async (query: OracleQuery) => {
    const out: ExternalProductDTO[] = [];
    let lastCode = -1;

    while (out.length < MAX_ROWS) {
      const rows = await query<ProductRow>(
        `SELECT p.codprod      AS "CODPROD",
                p.descricao    AS "DESCRICAO",
                p.codauxiliar  AS "CODAUXILIAR",
                p.unidade      AS "UNIDADE",
                p.pvenda       AS "PVENDA",
                p.dtexclusao   AS "DTEXCLUSAO",
                p.qtunitcx     AS "QTUNITCX"
           FROM ${schema}.pcprodut p
          WHERE p.codprod > :lastCode
          ORDER BY p.codprod
          FETCH FIRST ${PAGE_SIZE} ROWS ONLY`,
        { lastCode },
      );
      if (rows.length === 0) break;
      for (const row of rows) out.push(toDTO(row));
      lastCode = Number(rows[rows.length - 1].CODPROD);
      // Página incompleta = acabou; evita uma ida a mais ao banco.
      if (rows.length < PAGE_SIZE) break;
    }

    return out;
  });
}

interface StockRow {
  CODPROD: number | string;
  CODFILIAL: number | string;
  FANTASIA: string | null;
  QTESTGER: number | null;
}

/**
 * Estoque por filial (`PCEST`), só o que TEM estoque.
 *
 * `QTESTGER >= 1` no WHERE, não no cliente: é o recorte que interessa ao
 * catálogo ("produto ativo é o que tem pelo menos 1 em estoque") e é o que
 * mantém o volume na casa dos milhares em vez de `produtos × filiais`.
 *
 * A paginação avança pela TUPLA (codprod, codfilial), não só pelo produto:
 * paginar só por `codprod` cortaria um produto no meio quando as filiais dele
 * caem em páginas diferentes, e as que sobrassem sumiriam do espelho.
 */
export async function fetchWinthorProductStock(
  config: OracleConfig,
): Promise<ExternalProductStockDTO[]> {
  const schema = assertIdentifier(config.schema);

  return withOracleReadOnly(config, async (query: OracleQuery) => {
    const out: ExternalProductStockDTO[] = [];
    let lastCode = -1;
    let lastBranch = "";

    while (out.length < MAX_ROWS) {
      const rows = await query<StockRow>(
        `SELECT e.codprod    AS "CODPROD",
                e.codfilial  AS "CODFILIAL",
                f.fantasia   AS "FANTASIA",
                e.qtestger   AS "QTESTGER"
           FROM ${schema}.pcest e
           LEFT JOIN ${schema}.pcfilial f ON f.codigo = e.codfilial
          WHERE e.qtestger >= 1
            AND (e.codprod > :lastCode
                 OR (e.codprod = :lastCode AND e.codfilial > :lastBranch))
          ORDER BY e.codprod, e.codfilial
          FETCH FIRST ${PAGE_SIZE} ROWS ONLY`,
        { lastCode, lastBranch },
      );
      if (rows.length === 0) break;

      for (const row of rows) {
        out.push({
          externalCode: String(row.CODPROD),
          branchCode: String(row.CODFILIAL).trim(),
          branchName: row.FANTASIA?.trim() || null,
          stock: Number(row.QTESTGER ?? 0),
        });
      }

      const last = rows[rows.length - 1];
      lastCode = Number(last.CODPROD);
      lastBranch = String(last.CODFILIAL).trim();
      if (rows.length < PAGE_SIZE) break;
    }

    return out;
  });
}

interface LastSalePriceRow {
  CODPROD: number | string;
  PTABELA: number | null;
}

/** Janela do último preço vendido: curta o bastante para o preço ser atual e o filtro usar o índice de data. */
export const LAST_SALE_PRICE_DAYS = 90;

/**
 * Último preço de tabela (`PCPEDI.PTABELA`) de cada produto vendido na filial
 * nos últimos {@link LAST_SALE_PRICE_DAYS} dias, pedidos não cancelados.
 *
 * Fonte provisória: o preço de venda do Winthor mora em `PCTABPR`/`PCEMBALAGEM`,
 * sem permissão de leitura na Armazém (spec erp-sync-estoque-preco-winthor).
 * `PCPEDI` tem ~17 mi de linhas: data e filial vão no WHERE para o Oracle
 * filtrar antes da janela, e a consulta roda só no sync noturno ou no botão.
 */
export async function fetchWinthorLastSalePrices(
  config: OracleConfig,
  branchCode: string,
): Promise<Array<{ externalCode: string; price: number }>> {
  const schema = assertIdentifier(config.schema);

  return withOracleReadOnly(config, async (query: OracleQuery) => {
    const rows = await query<LastSalePriceRow>(
      `SELECT "CODPROD", "PTABELA"
         FROM (SELECT i.codprod AS "CODPROD",
                      i.ptabela AS "PTABELA",
                      ROW_NUMBER() OVER (
                        PARTITION BY i.codprod
                        ORDER BY i.data DESC, i.numped DESC, i.numseq DESC
                      ) AS rn
                 FROM ${schema}.pcpedi i
                WHERE i.data >= TRUNC(SYSDATE) - :days
                  AND i.codfilialretira = :branchCode
                  AND i.ptabela > 0
                  AND i.posicao <> 'C')
        WHERE rn = 1
        FETCH FIRST ${MAX_ROWS} ROWS ONLY`,
      { days: LAST_SALE_PRICE_DAYS, branchCode },
    );
    return rows.map((row) => ({
      externalCode: String(row.CODPROD),
      price: Number(row.PTABELA ?? 0),
    }));
  });
}
