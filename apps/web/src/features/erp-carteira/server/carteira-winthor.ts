import "server-only";

import { loadOracleConfig } from "@/features/erp-sync/server/connectors";
import {
  type OracleBinds,
  type OracleQuery,
  withOracleReadOnly,
} from "@/features/erp-sync/server/oracle-client";
import { assertIdentifier } from "@/features/erp-sync/server/oracle-explorer/identifier";

/**
 * Carteira de clientes do Winthor para o Órbita (spec 0106 do Órbita, fase 1).
 * Só leitura, uma página de clientes por chamada: cadastro (`PCCLIENT`), dívida
 * vencida (`PCPREST`), pedidos faturados (`PCPEDC`) e o que comprou (`PCMOV`).
 */

export const MAX_CLIENTES_POR_PAGINA = 200;
/** Pedidos por cliente que vão para a Jornada (os mais recentes). */
const MAX_PEDIDOS_POR_CLIENTE = 120;
/** Janela do "o que comprou" (interesses e últimos produtos). */
const MESES_DE_ITENS = 12;
const MAX_INTERESSES = 3;
const MAX_ULTIMOS_PRODUTOS = 5;

export type PedidoDoCliente = {
  numero: string;
  data: string;
  valor: number;
  filial: string | null;
};

export type ClienteDaCarteira = {
  codigo: string;
  nome: string;
  documento: string | null;
  telefones: string[];
  email: string | null;
  filial: { codigo: string; nome: string } | null;
  consultor: { codigo: string; nome: string } | null;
  clienteDesde: string | null;
  primeiraCompra: string | null;
  ultimaCompra: string | null;
  valorUltimaCompra: number | null;
  totalComprado: number;
  quantidadeDePedidos: number;
  divida: {
    valor: number;
    parcelas: number;
    vencimentoMaisAntigo: string;
  } | null;
  interesses: string[];
  ultimosProdutos: string[];
  pedidos: PedidoDoCliente[];
};

type LinhaCliente = {
  CODCLI: number | string;
  CLIENTE: string | null;
  FANTASIA: string | null;
  CGCENT: string | null;
  TELCELENT: string | null;
  TELENT: string | null;
  TELCOM: string | null;
  EMAIL: string | null;
  DTCADASTRO: Date | null;
  CODFILIALNF: string | number | null;
  FILIALNOME: string | null;
  CODUSUR1: number | string | null;
  CONSULTOR: string | null;
};

type LinhaDivida = {
  CODCLI: number | string;
  VALOR: number | null;
  PARCELAS: number | null;
  VENCIMENTO: Date | null;
};

type LinhaPedido = {
  CODCLI: number | string;
  NUMPED: number | string;
  DATA: Date | null;
  VLTOTAL: number | null;
  CODFILIAL: string | number | null;
  TOTALCOMPRADO: number | null;
  QTDPEDIDOS: number | null;
  PRIMEIRA: Date | null;
};

type LinhaItem = {
  CODCLI: number | string;
  PRODUTO: string | null;
  DEPARTAMENTO: string | null;
  VALOR: number | null;
  ULTIMA: Date | null;
};

function toIsoDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toMoney(value: number | null): number {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function cleanText(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function onlyDigits(value: string | null): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length >= 8 ? digits : null;
}

/** `:c0, :c1, ...` com os códigos ligados — a lista vem da própria página, nunca do pedido. */
function bindCodigos(codigos: number[]): { lista: string; binds: OracleBinds } {
  const binds: OracleBinds = {};
  const nomes = codigos.map((codigo, index) => {
    binds[`c${index}`] = codigo;
    return `:c${index}`;
  });
  return { lista: nomes.join(", "), binds };
}

async function lerClientes(
  query: OracleQuery,
  schema: string,
  params: { aposCodigo: number; limite: number; desde: Date | null },
): Promise<LinhaCliente[]> {
  const binds: OracleBinds = { apos: params.aposCodigo };
  // Na atualização diária só entra quem comprou, pagou ou passou a dever desde a última vez.
  let filtroDesde = "";
  if (params.desde) {
    binds.desde = params.desde;
    filtroDesde = `AND (c.dtultcomp >= :desde OR c.codcli IN (
        SELECT p.codcli FROM ${schema}.pcprest p
         WHERE p.dtpag >= :desde
            OR (p.dtpag IS NULL AND p.dtvenc >= :desde AND p.dtvenc < TRUNC(SYSDATE))))`;
  }
  // O "consumidor final" do Winthor é o cliente genérico do balcão (milhões de pedidos), não uma pessoa.
  return query<LinhaCliente>(
    `SELECT c.codcli      AS "CODCLI",
            c.cliente     AS "CLIENTE",
            c.fantasia    AS "FANTASIA",
            c.cgcent      AS "CGCENT",
            c.telcelent   AS "TELCELENT",
            c.telent      AS "TELENT",
            c.telcom      AS "TELCOM",
            c.email       AS "EMAIL",
            c.dtcadastro  AS "DTCADASTRO",
            c.codfilialnf AS "CODFILIALNF",
            f.fantasia    AS "FILIALNOME",
            c.codusur1    AS "CODUSUR1",
            u.nome        AS "CONSULTOR"
       FROM ${schema}.pcclient c
       LEFT JOIN ${schema}.pcfilial f ON f.codigo = c.codfilialnf
       LEFT JOIN ${schema}.pcusuari u ON u.codusur = c.codusur1
      WHERE c.dtultcomp IS NOT NULL
        AND c.dtexclusao IS NULL
        AND UPPER(c.cliente) NOT LIKE '%CONSUMIDOR FINAL%'
        AND c.codcli > :apos
        ${filtroDesde}
      ORDER BY c.codcli
      FETCH FIRST ${params.limite} ROWS ONLY`,
    binds,
  );
}

async function lerDividas(
  query: OracleQuery,
  schema: string,
  codigos: number[],
) {
  const { lista, binds } = bindCodigos(codigos);
  return query<LinhaDivida>(
    `SELECT p.codcli      AS "CODCLI",
            SUM(p.valor)  AS "VALOR",
            COUNT(*)      AS "PARCELAS",
            MIN(p.dtvenc) AS "VENCIMENTO"
       FROM ${schema}.pcprest p
      WHERE p.codcli IN (${lista})
        AND p.dtpag IS NULL
        AND p.dtvenc < TRUNC(SYSDATE)
      GROUP BY p.codcli`,
    binds,
  );
}

async function lerPedidos(
  query: OracleQuery,
  schema: string,
  codigos: number[],
) {
  const { lista, binds } = bindCodigos(codigos);
  return query<LinhaPedido>(
    `SELECT codcli AS "CODCLI", numped AS "NUMPED", data AS "DATA", vltotal AS "VLTOTAL",
            codfilial AS "CODFILIAL", totalcomprado AS "TOTALCOMPRADO",
            qtdpedidos AS "QTDPEDIDOS", primeira AS "PRIMEIRA"
       FROM (
         SELECT p.codcli, p.numped, p.data, p.vltotal, p.codfilial,
                SUM(p.vltotal) OVER (PARTITION BY p.codcli) AS totalcomprado,
                COUNT(*)       OVER (PARTITION BY p.codcli) AS qtdpedidos,
                MIN(p.data)    OVER (PARTITION BY p.codcli) AS primeira,
                ROW_NUMBER()   OVER (PARTITION BY p.codcli ORDER BY p.data DESC, p.numped DESC) AS ordem
           FROM ${schema}.pcpedc p
          WHERE p.codcli IN (${lista})
            AND p.dtcancel IS NULL
            AND p.posicao = 'F')
      WHERE ordem <= ${MAX_PEDIDOS_POR_CLIENTE}`,
    binds,
  );
}

async function lerItens(query: OracleQuery, schema: string, codigos: number[]) {
  const { lista, binds } = bindCodigos(codigos);
  return query<LinhaItem>(
    `SELECT m.codcli          AS "CODCLI",
            pr.descricao      AS "PRODUTO",
            d.descricao       AS "DEPARTAMENTO",
            SUM(m.qt * m.punit) AS "VALOR",
            MAX(m.dtmov)      AS "ULTIMA"
       FROM ${schema}.pcmov m
       JOIN ${schema}.pcprodut pr ON pr.codprod = m.codprod
       LEFT JOIN ${schema}.pcdepto d ON d.codepto = pr.codepto
      WHERE m.codcli IN (${lista})
        AND m.codoper = 'S'
        AND m.dtcancel IS NULL
        AND m.dtmov >= ADD_MONTHS(TRUNC(SYSDATE), -${MESES_DE_ITENS})
      GROUP BY m.codcli, pr.descricao, d.descricao`,
    binds,
  );
}

function agruparPorCliente<T extends { CODCLI: number | string }>(linhas: T[]) {
  const porCliente = new Map<string, T[]>();
  for (const linha of linhas) {
    const codigo = String(linha.CODCLI);
    const lista = porCliente.get(codigo) ?? [];
    lista.push(linha);
    porCliente.set(codigo, lista);
  }
  return porCliente;
}

function resumirItens(itens: LinhaItem[]) {
  const valorPorDepartamento = new Map<string, number>();
  for (const item of itens) {
    const departamento = cleanText(item.DEPARTAMENTO);
    if (!departamento) continue;
    valorPorDepartamento.set(
      departamento,
      (valorPorDepartamento.get(departamento) ?? 0) + Number(item.VALOR ?? 0),
    );
  }
  const interesses = [...valorPorDepartamento.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, MAX_INTERESSES)
    .map(([departamento]) => departamento);
  const ultimosProdutos = [...itens]
    .sort(
      (left, right) =>
        (right.ULTIMA?.getTime() ?? 0) - (left.ULTIMA?.getTime() ?? 0),
    )
    .flatMap((item) => {
      const produto = cleanText(item.PRODUTO);
      return produto ? [produto] : [];
    })
    .slice(0, MAX_ULTIMOS_PRODUTOS);
  return { interesses, ultimosProdutos };
}

/**
 * Uma página da carteira, em ordem de código. `proximoCursor` nulo = acabou.
 * Os itens (`PCMOV`) são a parte mais pesada: se a leitura falhar, a página
 * sai sem interesses em vez de falhar inteira.
 */
export async function listarCarteiraDoWinthor(params: {
  organizationId: string;
  cursor: string | null;
  desde: Date | null;
  limite: number;
}): Promise<{ clientes: ClienteDaCarteira[]; proximoCursor: string | null }> {
  const config = await loadOracleConfig(params.organizationId);
  const schema = assertIdentifier(config.schema);
  const limite = Math.min(
    Math.max(1, Math.trunc(params.limite)),
    MAX_CLIENTES_POR_PAGINA,
  );
  const aposCodigo = params.cursor ? Number(params.cursor) : 0;

  return withOracleReadOnly(
    config,
    async (query) => {
      const linhas = await lerClientes(query, schema, {
        aposCodigo: Number.isFinite(aposCodigo) ? aposCodigo : 0,
        limite,
        desde: params.desde,
      });
      if (linhas.length === 0) return { clientes: [], proximoCursor: null };

      const codigos = linhas.map((linha) => Number(linha.CODCLI));
      const [dividas, pedidos, itens] = await Promise.all([
        lerDividas(query, schema, codigos),
        lerPedidos(query, schema, codigos),
        lerItens(query, schema, codigos).catch(() => [] as LinhaItem[]),
      ]);
      const dividaPorCliente = new Map(
        dividas.map((linha) => [String(linha.CODCLI), linha]),
      );
      const pedidosPorCliente = agruparPorCliente(pedidos);
      const itensPorCliente = agruparPorCliente(itens);

      const clientes = linhas.map((linha): ClienteDaCarteira => {
        const codigo = String(linha.CODCLI);
        const divida = dividaPorCliente.get(codigo);
        const pedidosDoCliente = (pedidosPorCliente.get(codigo) ?? []).sort(
          (left, right) =>
            (right.DATA?.getTime() ?? 0) - (left.DATA?.getTime() ?? 0),
        );
        const maisRecente = pedidosDoCliente[0];
        const telefones = [linha.TELCELENT, linha.TELENT, linha.TELCOM].flatMap(
          (telefone) => {
            const digits = onlyDigits(telefone);
            return digits ? [digits] : [];
          },
        );
        const codigoFilial =
          linha.CODFILIALNF === null ? null : String(linha.CODFILIALNF);
        const codigoConsultor =
          linha.CODUSUR1 === null ? null : String(linha.CODUSUR1);
        return {
          codigo,
          nome:
            cleanText(linha.CLIENTE) ??
            cleanText(linha.FANTASIA) ??
            `Cliente ${codigo}`,
          documento: onlyDigits(linha.CGCENT),
          telefones: [...new Set(telefones)],
          email: cleanText(linha.EMAIL)?.toLowerCase() ?? null,
          filial: codigoFilial
            ? {
                codigo: codigoFilial,
                nome: cleanText(linha.FILIALNOME) ?? `Filial ${codigoFilial}`,
              }
            : null,
          consultor: codigoConsultor
            ? {
                codigo: codigoConsultor,
                nome:
                  cleanText(linha.CONSULTOR) ?? `Consultor ${codigoConsultor}`,
              }
            : null,
          clienteDesde: toIsoDate(linha.DTCADASTRO),
          primeiraCompra: toIsoDate(maisRecente?.PRIMEIRA ?? null),
          ultimaCompra: toIsoDate(maisRecente?.DATA ?? null),
          valorUltimaCompra: maisRecente ? toMoney(maisRecente.VLTOTAL) : null,
          totalComprado: toMoney(maisRecente?.TOTALCOMPRADO ?? 0),
          quantidadeDePedidos: Number(maisRecente?.QTDPEDIDOS ?? 0),
          divida:
            divida && Number(divida.VALOR ?? 0) > 0
              ? {
                  valor: toMoney(divida.VALOR),
                  parcelas: Number(divida.PARCELAS ?? 0),
                  vencimentoMaisAntigo: toIsoDate(divida.VENCIMENTO) ?? "",
                }
              : null,
          ...resumirItens(itensPorCliente.get(codigo) ?? []),
          pedidos: pedidosDoCliente.flatMap((pedido) =>
            pedido.DATA
              ? [
                  {
                    numero: String(pedido.NUMPED),
                    data: pedido.DATA.toISOString(),
                    valor: toMoney(pedido.VLTOTAL),
                    filial:
                      pedido.CODFILIAL === null
                        ? null
                        : String(pedido.CODFILIAL),
                  },
                ]
              : [],
          ),
        };
      });

      return {
        clientes,
        proximoCursor:
          linhas.length < limite
            ? null
            : String(linhas[linhas.length - 1]?.CODCLI),
      };
    },
    { callTimeoutMs: 60_000 },
  );
}
