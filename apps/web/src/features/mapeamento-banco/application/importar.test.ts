import { describe, expect, it, vi } from "vitest";
import type { ValorCru } from "../domain/converter";
import { coluna, PCPRODUT, resumo, tabela } from "../domain/fixtures";
import type { ProdutoLocal, RegistroDeEstoque } from "../domain/importacao";
import {
  type ConfigDoTipo,
  type Mapeamento,
  mapeamentoVazio,
} from "../domain/mapeamento";
import type { BancoDeDadosPort, PedidoDeLeituraMapeada } from "../ports/banco";
import type { DestinoNoNerpPort } from "../ports/destino";
import { type Dependencias, LeituraRecusada } from "./dependencias";
import { importarLote, simularImportacao } from "./importar";

const PCEST = tabela("PCEST", 90_683, [
  coluna("CODPROD", "numero"),
  coluna("CODFILIAL", "texto"),
  coluna("QTESTGER", "numero"),
  coluna("QTRESERV", "numero"),
]);
const PCCLIENT = tabela("PCCLIENT", 27_885, [
  coluna("CODCLI", "numero"),
  coluna("CLIENTE", "texto"),
  coluna("CGCENT", "texto"),
]);

const base = (nome: string) => ({ de: "base" as const, nome });

const CONFIGS: Partial<
  Record<"produto" | "estoque" | "cliente", ConfigDoTipo>
> = {
  produto: {
    modo: "manual",
    origem: {
      tabela: { schema: "LGCARVALHO", nome: "PCPRODUT" },
      colunas: {
        codigo: base("CODPROD"),
        nome: base("DESCRICAO"),
        ean: base("CODAUXILIAR"),
      },
      conversoes: {},
      filtros: [],
    },
  },
  estoque: {
    modo: "manual",
    origem: {
      tabela: { schema: "LGCARVALHO", nome: "PCEST" },
      colunas: {
        codigoProduto: base("CODPROD"),
        filial: base("CODFILIAL"),
        quantidade: base("QTESTGER"),
        reservada: base("QTRESERV"),
      },
      conversoes: {},
      filtros: [],
    },
  },
  cliente: {
    modo: "manual",
    origem: {
      tabela: { schema: "LGCARVALHO", nome: "PCCLIENT" },
      colunas: {
        codigo: base("CODCLI"),
        nome: base("CLIENTE"),
        documento: base("CGCENT"),
      },
      conversoes: {},
      filtros: [],
    },
  },
};

/**
 * Banco falso que pagina como o Oracle: ordena pela primeira chave e devolve
 * só o que vem depois do cursor.
 */
function montar(
  linhas: Record<string, ValorCru>[],
  opcoes: { mapeado?: boolean; produtos?: ProdutoLocal[] } = {},
) {
  const leituras: PedidoDeLeituraMapeada[] = [];
  const tabelas = [PCPRODUT, PCEST, PCCLIENT];
  const banco: BancoDeDadosPort = {
    descricao: {
      motor: "oracle",
      rotuloDoMotor: "Oracle",
      schemaPrincipal: "LGCARVALHO",
      servidor: "erp:1521/X",
    },
    testarConexao: async () => {},
    listarTabelas: async () => tabelas.map(resumo),
    descreverTabela: async (ref) =>
      tabelas.find((t) => t.schema === ref.schema && t.nome === ref.nome) ??
      null,
    descreverSchema: async () => tabelas,
    amostrar: async () => ({
      colunas: [],
      linhas: [],
      temMais: false,
      tempoMs: 0,
    }),
    perfilarColuna: async () => {
      throw new Error("não usado");
    },
    buscarColunas: async () => [],
    lerMapeado: async (pedido) => {
      leituras.push(pedido);
      const chave = pedido.alvo.chave[0];
      const depoisDe = pedido.paginacao?.depoisDe?.[0];
      return linhas
        .filter(
          (linha) =>
            depoisDe === undefined ||
            depoisDe === null ||
            Number(linha[chave]) > Number(depoisDe),
        )
        .slice(0, pedido.limite);
    },
    esquecerEstrutura: () => {},
    explicarFalha: () => "falhou",
  };
  const mapeamento: Mapeamento = mapeamentoVazio();
  if (opcoes.mapeado !== false) {
    for (const [tipo, config] of Object.entries(CONFIGS)) {
      mapeamento.tipos[tipo as keyof typeof CONFIGS] = config;
    }
  }
  const destino: DestinoNoNerpPort = {
    produtosLocais: vi.fn(async () => opcoes.produtos ?? []),
    aplicarProdutos: vi.fn(async (acoes) => ({
      gravados: acoes.filter((acao) => acao.acao !== "ignorar").length,
      falhas: [],
    })),
    clientesLocais: vi.fn(async () => []),
    aplicarClientes: vi.fn(async (acoes) => ({
      gravados: acoes.length,
      falhas: [],
    })),
    produtosVinculados: vi.fn(async () => new Map([["10", "p10"]])),
    filialDoEstoque: vi.fn(async () => "2"),
    substituirEstoque: vi.fn(async (_registros: RegistroDeEstoque[]) => ({
      produtosAtualizados: 1,
    })),
  };
  const deps: Dependencias = {
    banco,
    vocabulario: {
      nome: "Winthor",
      tabela: () => null,
      coluna: () => null,
      perfis: () => [],
    },
    repositorio: { carregar: async () => mapeamento, salvar: async () => {} },
    nerp: { codigosExistentes: async () => null },
    destino,
  };
  return { deps, destino, leituras };
}

const produtos = (quantos: number) =>
  Array.from({ length: quantos }, (_, indice) => ({
    codigo: indice + 1,
    nome: `Produto ${indice + 1}`,
    ean: null,
  }));

describe("simularImportacao", () => {
  it("lê todas as páginas do ERP e não grava nada", async () => {
    const { deps, destino, leituras } = montar(produtos(5001));
    const simulacao = await simularImportacao(deps, "produto", {
      criarFaltantes: true,
    });
    expect(leituras).toHaveLength(2);
    expect(leituras[1].paginacao?.depoisDe).toEqual([5000]);
    expect(simulacao.lidas).toBe(5001);
    expect(simulacao.completo).toBe(true);
    expect(simulacao.resumo?.criar).toBe(5001);
    expect(destino.aplicarProdutos).not.toHaveBeenCalled();
  });

  it("tira a linha com obrigatório vazio e conta como erro", async () => {
    const { deps } = montar([
      { codigo: 1, nome: "Leite", ean: null },
      { codigo: 2, nome: null, ean: null },
    ]);
    const simulacao = await simularImportacao(deps, "produto", {
      criarFaltantes: true,
    });
    expect(simulacao.comErro).toBe(1);
    expect(simulacao.errosDeExemplo[0]).toEqual({
      codigo: "2",
      erros: ["Nome: vazio."],
    });
    expect(simulacao.resumo?.criar).toBe(1);
  });

  it("recusa o tipo cujo mapeamento não está pronto", async () => {
    const { deps } = montar([], { mapeado: false });
    await expect(
      simularImportacao(deps, "produto", { criarFaltantes: false }),
    ).rejects.toBeInstanceOf(LeituraRecusada);
  });

  it("no estoque, mostra a filial que vira o estoque do produto", async () => {
    const { deps, destino } = montar([
      { codigoProduto: 10, filial: "2", quantidade: 8, reservada: 3 },
      { codigoProduto: 10, filial: "1", quantidade: 5, reservada: 0 },
      { codigoProduto: 99, filial: "2", quantidade: 4, reservada: 0 },
    ]);
    const simulacao = await simularImportacao(deps, "estoque", {
      criarFaltantes: false,
    });
    expect(simulacao.estoque).toMatchObject({
      registrosComDisponivel: 2,
      semProdutoNoNerp: 1,
      filialDoEstoque: "2",
      produtosComEstoqueNaFilial: 1,
    });
    expect(destino.substituirEstoque).not.toHaveBeenCalled();
  });

  it("mascara o documento do cliente nos exemplos", async () => {
    const { deps } = montar([
      { codigo: 7, nome: "Mercado Bom Preço", documento: "11.222.333/0001-81" },
    ]);
    const simulacao = await simularImportacao(deps, "cliente", {
      criarFaltantes: true,
    });
    const detalhe = simulacao.resumo?.exemplos[0]?.detalhe ?? "";
    expect(detalhe).toContain("•••0181");
    expect(detalhe).not.toContain("11222333");
  });
});

describe("importarLote", () => {
  it("grava uma página por chamada e devolve onde parou", async () => {
    const { deps, destino } = montar(produtos(3), {
      produtos: [
        {
          id: "p1",
          erpCode: "1",
          barcode: null,
          packQty: null,
          erpActive: null,
        },
      ],
    });
    const primeiro = await importarLote(deps, "produto", {
      criarFaltantes: false,
      depoisDe: null,
      tamanho: 2,
    });
    expect(primeiro.lidas).toBe(2);
    expect(primeiro.proximo).toEqual([2]);
    expect(destino.aplicarProdutos).toHaveBeenCalledTimes(1);

    const segundo = await importarLote(deps, "produto", {
      criarFaltantes: false,
      depoisDe: primeiro.proximo,
      tamanho: 2,
    });
    expect(segundo.lidas).toBe(1);
    expect(segundo.proximo).toBeNull();
  });

  it("limita o lote ao máximo", async () => {
    const { deps, leituras } = montar(produtos(1));
    await importarLote(deps, "produto", {
      criarFaltantes: false,
      depoisDe: null,
      tamanho: 50_000,
    });
    expect(leituras[0].limite).toBe(3000);
  });

  it("troca o estoque inteiro numa chamada, só com o disponível", async () => {
    const { deps, destino } = montar([
      { codigoProduto: 10, filial: "2", quantidade: 8, reservada: 3 },
      { codigoProduto: 10, filial: "1", quantidade: 2, reservada: 2 },
    ]);
    const resultado = await importarLote(deps, "estoque", {
      criarFaltantes: false,
      depoisDe: null,
      tamanho: 10,
    });
    expect(resultado.proximo).toBeNull();
    expect(resultado.estoque).toEqual({
      registros: 1,
      semProdutoNoNerp: 0,
      produtosAtualizados: 1,
    });
    expect(destino.substituirEstoque).toHaveBeenCalledWith([
      expect.objectContaining({ productId: "p10", filial: "2", disponivel: 5 }),
    ]);
  });
});
