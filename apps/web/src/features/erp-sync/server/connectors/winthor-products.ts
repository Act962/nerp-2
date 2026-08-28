import "server-only";

import { assertIdentifier } from "../oracle-explorer/identifier";
import {
  withOracleReadOnly,
  type OracleConfig,
  type OracleQuery,
} from "../oracle-client";
import type { ExternalProductDTO } from "./types";

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
                p.dtexclusao   AS "DTEXCLUSAO"
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
