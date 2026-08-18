import "server-only";
import { isSellerBucketName } from "@/utils/seller-bucket";
import {
  type OracleConfig,
  type OracleQuery,
  withOracleReadOnly,
} from "../oracle-client";
import type {
  DateRange,
  ExternalSellerDTO,
  SalesConnector,
  SalesFactDTO,
} from "./types";

// Conector do TOTVS Winthor sobre Oracle. É o ÚNICO arquivo do projeto que pode
// conhecer PCPEDC, PCUSUARI e CODUSUR — acima daqui só existe linguagem de
// negócio.
//
// Dois recortes de venda, ambos com `condvenda = 1` (só venda normal — sem
// bonificação/transferência):
//   FATURADO  = posicao 'F'  → nota emitida, receita conservadora.
//   PIPELINE  = posicao <> 'C' → todo pedido não cancelado (inclui em andamento).
// O PIPELINE é o que o relatório de supervisor do Winthor mostra e é um
// superconjunto do FATURADO. O sync grava os dois; o board deixa o usuário
// escolher qual conta. `isActive` usa o mesmo recorte PIPELINE dos fatos: um
// vendedor com pedidos só em andamento conta como ativo (senão sumiria do
// bootstrap mas apareceria no período virtual — conjuntos inconsistentes).
// PENDENTE com o cliente: `condvenda = 10` (R$ 9,9 M em 24 meses, ticket ~R$ 8 k)
// não foi identificado e está fora da soma. Se for venda, todo número muda.
// O faturado é isolado direto na query pelo `CASE WHEN posicao = 'F'`
// (condvenda já está no WHERE), então não há constante separada para ele.
const VENDA_PIPELINE = "condvenda = 1 AND posicao <> 'C'";

// Vendedor "ativo" não é coluna no Winthor: dos 334 cadastrados só ~34 vendem.
// Derivamos de atividade recente para o ranking não listar carteira morta.
const DIAS_PARA_CONSIDERAR_ATIVO = 90;

const ORACLE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_$#]{0,29}$/;

// Nome de schema não pode ser bind variable em Oracle, então é interpolado.
// Validar antes é o que impede injeção por configuração de conexão.
function assertIdentifier(value: string): string {
  if (!ORACLE_IDENTIFIER.test(value)) {
    throw new Error(`Nome de schema Oracle inválido: ${value}`);
  }
  return value;
}

interface SellerRow {
  CODUSUR: number;
  NOME: string | null;
  CODFILIAL: string | null;
  CODSUPERVISOR: number | null;
  SUPERVISOR_NOME: string | null;
  PEDIDOS_RECENTES: number;
}

interface SalesRow {
  DIA: string;
  CODUSUR: number;
  RECEITA: number | null;
  CUSTO: number | null;
  PEDIDOS: number;
  CLIENTES: number;
  RECEITA_PIPE: number | null;
  CUSTO_PIPE: number | null;
  PEDIDOS_PIPE: number;
  CLIENTES_PIPE: number;
}

// Dia vem como texto e vira meia-noite UTC. Converter o DATE do Oracle direto
// para Date arrastaria o fuso da sessão e deslocaria o dia em um.
function toUtcDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function createWinthorConnector(config: OracleConfig): SalesConnector {
  const schema = assertIdentifier(config.schema);

  async function sellers(): Promise<ExternalSellerDTO[]> {
    const rows = await withOracleReadOnly(config, (query: OracleQuery) =>
      query<SellerRow>(
        // A equipe do vendedor é o SUPERVISOR (PCSUPERV) — a divisão comercial
        // real do Winthor. CODFILIAL é o depósito físico, não o time.
        `SELECT u.codusur          AS "CODUSUR",
                u.nome             AS "NOME",
                u.codfilial        AS "CODFILIAL",
                u.codsupervisor    AS "CODSUPERVISOR",
                s.nome             AS "SUPERVISOR_NOME",
                (SELECT COUNT(*)
                   FROM ${schema}.pcpedc p
                  WHERE p.codusur = u.codusur
                    AND ${VENDA_PIPELINE}
                    AND p.data >= TRUNC(SYSDATE) - :dias) AS "PEDIDOS_RECENTES"
           FROM ${schema}.pcusuari u
           LEFT JOIN ${schema}.pcsuperv s ON s.codsupervisor = u.codsupervisor`,
        { dias: DIAS_PARA_CONSIDERAR_ATIVO },
      ),
    );

    return rows.map((row) => {
      const name = row.NOME?.trim() || `Vendedor ${row.CODUSUR}`;
      return {
        externalCode: String(row.CODUSUR),
        name,
        branchCode: row.CODFILIAL?.trim() || null,
        supervisorCode:
          row.CODSUPERVISOR === null ? null : String(row.CODSUPERVISOR),
        supervisorName: row.SUPERVISOR_NOME?.trim() || null,
        isBucket: isSellerBucketName(name),
        isActive: row.PEDIDOS_RECENTES > 0,
      };
    });
  }

  async function salesBySellerDaily(range: DateRange): Promise<SalesFactDTO[]> {
    // `to` é inclusivo no contrato; a query usa limite superior exclusivo.
    const toExclusive = new Date(range.to);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

    const rows = await withOracleReadOnly(config, (query: OracleQuery) =>
      query<SalesRow>(
        // Uma passada só: o WHERE externo traz o superconjunto (pipeline) e o
        // CASE isola o faturado dentro dele — os números de faturado ficam
        // idênticos ao filtro `posicao='F'` de antes.
        `SELECT TO_CHAR(p.data, 'YYYY-MM-DD')   AS "DIA",
                p.codusur                       AS "CODUSUR",
                SUM(CASE WHEN p.posicao = 'F' THEN p.vltotal ELSE 0 END)        AS "RECEITA",
                SUM(CASE WHEN p.posicao = 'F' THEN p.vlcustoreal ELSE 0 END)    AS "CUSTO",
                COUNT(CASE WHEN p.posicao = 'F' THEN 1 END)                     AS "PEDIDOS",
                COUNT(DISTINCT CASE WHEN p.posicao = 'F' THEN p.codcli END)     AS "CLIENTES",
                SUM(p.vltotal)                  AS "RECEITA_PIPE",
                SUM(p.vlcustoreal)              AS "CUSTO_PIPE",
                COUNT(*)                        AS "PEDIDOS_PIPE",
                COUNT(DISTINCT p.codcli)        AS "CLIENTES_PIPE"
           FROM ${schema}.pcpedc p
          WHERE ${VENDA_PIPELINE}
            AND p.data >= :dataInicio
            AND p.data <  :dataFim
          GROUP BY TO_CHAR(p.data, 'YYYY-MM-DD'), p.codusur`,
        { dataInicio: range.from, dataFim: toExclusive },
      ),
    );

    return rows.map((row) => ({
      date: toUtcDate(row.DIA),
      sellerExternalCode: String(row.CODUSUR),
      revenue: Number(row.RECEITA ?? 0),
      cost: Number(row.CUSTO ?? 0),
      orders: Number(row.PEDIDOS ?? 0),
      customers: Number(row.CLIENTES ?? 0),
      revenuePipeline: Number(row.RECEITA_PIPE ?? 0),
      costPipeline: Number(row.CUSTO_PIPE ?? 0),
      ordersPipeline: Number(row.PEDIDOS_PIPE ?? 0),
      customersPipeline: Number(row.CLIENTES_PIPE ?? 0),
    }));
  }

  return { kind: "WINTHOR_ORACLE", sellers, salesBySellerDaily };
}

export interface WinthorTestResult {
  /** Vendedores no cadastro (PCUSUARI) — confirma auth E acesso ao schema. */
  sellerCount: number;
}

/**
 * Valida uma config antes de salvar: além de autenticar, confere que o schema
 * existe e é legível contando `PCUSUARI`. Um `SELECT 1 FROM dual` passaria com
 * credencial certa mas schema errado — aqui o erro sai na hora do teste, não no
 * primeiro sync.
 */
export async function testWinthorConfig(
  config: OracleConfig,
): Promise<WinthorTestResult> {
  const schema = assertIdentifier(config.schema);
  const rows = await withOracleReadOnly(config, (query: OracleQuery) =>
    query<{ TOTAL: number }>(
      `SELECT COUNT(*) AS "TOTAL" FROM ${schema}.pcusuari`,
    ),
  );
  return { sellerCount: Number(rows[0]?.TOTAL ?? 0) };
}
