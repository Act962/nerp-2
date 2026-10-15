import "server-only";

import { loadOracleConfig } from "@/features/erp-sync/server/connectors";
import { withOracleReadOnly } from "@/features/erp-sync/server/oracle-client";
import { assertIdentifier } from "@/features/erp-sync/server/oracle-explorer/identifier";
import prisma from "@/lib/db";

/**
 * "Quais clientes estão em atraso e compraram o produto X?" no Winthor.
 *
 * O construtor de consultas do Astro é de uma tabela só; aqui é preciso cruzar
 * parcela (`PCPREST`) com item vendido (`PCMOV`) pelo número da venda
 * (`NUMTRANSVENDA`). A consulta é fixa — o modelo só escolhe o produto, a filial
 * e há quantos dias venceu —, com o mesmo critério de "inadimplente" do
 * indicador `inadimplencia`: parcela vencida e sem data de pagamento.
 */

export type ProdutoDoErp = { nome: string; codigoErp: string };

export type InadimplenteDoProduto = {
  cliente: string;
  codigoCliente: string;
  emAtraso: number;
  parcelas: number;
  vencimentoMaisAntigo: string;
};

/** Vendas olhadas para trás: limita o `PCMOV` (a maior tabela do Winthor) ao que ainda pode ter parcela aberta. */
const MESES_DE_VENDA = 24;
/** Quantos clientes voltam na lista. */
const MAX_CLIENTES = 20;
/** Quantos produtos parecidos oferecer quando o nome é ambíguo. */
const MAX_CANDIDATOS = 6;

/** O produto do pedido, só entre os vinculados ao ERP (sem `erpCode` não há como achar no Oracle). */
export async function resolverProdutoDoErp(
  organizationId: string,
  termo: string,
): Promise<ProdutoDoErp[]> {
  const texto = termo.trim();
  const produtos = await prisma.product.findMany({
    where: {
      organizationId,
      erpCode: { not: null },
      OR: [
        { erpCode: texto },
        { sku: texto },
        { barcode: texto },
        { name: { contains: texto, mode: "insensitive" } },
      ],
    },
    select: { name: true, erpCode: true },
    orderBy: { name: "asc" },
    take: MAX_CANDIDATOS,
  });
  return produtos.flatMap((produto) =>
    produto.erpCode ? [{ nome: produto.name, codigoErp: produto.erpCode }] : [],
  );
}

type LinhaDoOracle = {
  CODCLI: number | string;
  CLIENTE: string | null;
  VALOR: number | null;
  PARCELAS: number | null;
  VENCIMENTO: Date | null;
  TOTALCLIENTES: number | null;
  TOTALVALOR: number | null;
};

export async function buscarInadimplentesDoProduto(params: {
  organizationId: string;
  codigoErp: string;
  /** Código da filial, ou null para a empresa inteira. */
  filial: string | null;
  /** Vencida há mais de N dias (0 = todas as vencidas). */
  diasVencido: number;
}): Promise<{
  totalClientes: number;
  totalEmAtraso: number;
  clientes: InadimplenteDoProduto[];
}> {
  const config = await loadOracleConfig(params.organizationId);
  const schema = assertIdentifier(config.schema);

  const linhas = await withOracleReadOnly(
    config,
    (query) =>
      query<LinhaDoOracle>(
        `SELECT c.codcli  AS "CODCLI",
                c.cliente AS "CLIENTE",
                SUM(p.valor)  AS "VALOR",
                COUNT(*)      AS "PARCELAS",
                MIN(p.dtvenc) AS "VENCIMENTO",
                COUNT(*) OVER ()          AS "TOTALCLIENTES",
                SUM(SUM(p.valor)) OVER () AS "TOTALVALOR"
           FROM ${schema}.pcprest p
           JOIN ${schema}.pcclient c ON c.codcli = p.codcli
          WHERE p.dtpag IS NULL
            AND p.dtvenc < TRUNC(SYSDATE) - :dias
            AND (:filial IS NULL OR p.codfilial = :filial)
            AND p.numtransvenda IN (
                  SELECT m.numtransvenda
                    FROM ${schema}.pcmov m
                   WHERE m.codprod = :codprod
                     AND m.codoper = 'S'
                     AND m.dtmov >= ADD_MONTHS(TRUNC(SYSDATE), -${MESES_DE_VENDA}))
          GROUP BY c.codcli, c.cliente
          ORDER BY SUM(p.valor) DESC
          FETCH FIRST ${MAX_CLIENTES} ROWS ONLY`,
        {
          dias: params.diasVencido,
          filial: params.filial,
          codprod: Number(params.codigoErp),
        },
      ),
    { callTimeoutMs: 30_000 },
  );

  const primeira = linhas[0];
  return {
    totalClientes: Number(primeira?.TOTALCLIENTES ?? 0),
    totalEmAtraso: Math.round(Number(primeira?.TOTALVALOR ?? 0) * 100) / 100,
    clientes: linhas.map((linha) => ({
      cliente: linha.CLIENTE?.trim() || `Cliente ${linha.CODCLI}`,
      codigoCliente: String(linha.CODCLI),
      emAtraso: Math.round(Number(linha.VALOR ?? 0) * 100) / 100,
      parcelas: Number(linha.PARCELAS ?? 0),
      vencimentoMaisAntigo: linha.VENCIMENTO
        ? linha.VENCIMENTO.toISOString().slice(0, 10)
        : "",
    })),
  };
}
