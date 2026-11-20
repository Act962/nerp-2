import { describe, expect, it } from "vitest";
import type { ValorCru } from "../domain/converter";
import type { Tabela, TabelaRef } from "../domain/estrutura";
import {
  coluna,
  PCPEDC,
  PCPEDI,
  PCPRODUT,
  resumo,
  tabela,
} from "../domain/fixtures";
import { type Mapeamento, mapeamentoVazio } from "../domain/mapeamento";
import type { PerfilAutomatico } from "../domain/perfis";
import type { BancoDeDadosPort, PedidoDeLeituraMapeada } from "../ports/banco";
import type { Dependencias } from "./dependencias";
import { MapeamentoInvalido } from "./dependencias";
import {
  salvarMapeamento,
  sugerirMapeamento,
  testarMapeamento,
} from "./mapear";

const PCEST = tabela("PCEST", 90_683, [
  coluna("CODPROD", "numero"),
  coluna("CODFILIAL", "texto"),
  coluna("QTESTGER", "numero"),
]);

const perfisDePreco: PerfilAutomatico[] = [
  {
    chave: "tabela",
    tipo: "preco",
    rotulo: "Tabela de preço",
    descricao: "",
    tabela: "PCTABPR",
    colunas: {
      codigoProduto: { de: "base", nome: "CODPROD" },
      preco: { de: "base", nome: "PVENDA" },
      regiao: { de: "base", nome: "NUMREGIAO" },
    },
  },
  {
    chave: "vendas",
    tipo: "preco",
    rotulo: "Pelas vendas",
    descricao: "",
    tabela: "PCPEDI",
    juncao: { tabela: "PCPEDC", de: "NUMPED", para: "NUMPED" },
    colunas: {
      codigoProduto: { de: "base", nome: "CODPROD" },
      preco: { de: "base", nome: "PTABELA" },
      regiao: { de: "juncao", nome: "NUMREGIAO" },
      data: { de: "base", nome: "DATA" },
    },
    janela: { coluna: { de: "base", nome: "DATA" }, dias: 90 },
  },
];

function montar(linhas: Record<string, ValorCru>[] = []) {
  const tabelas: Tabela[] = [PCPRODUT, PCPEDI, PCPEDC, PCEST];
  let salvo: Mapeamento = mapeamentoVazio();
  const leituras: PedidoDeLeituraMapeada[] = [];
  const banco: BancoDeDadosPort = {
    descricao: {
      motor: "oracle",
      rotuloDoMotor: "Oracle",
      schemaPrincipal: "LGCARVALHO",
      servidor: "erp:1521/X",
    },
    testarConexao: async () => {},
    listarTabelas: async () => tabelas.map(resumo),
    descreverTabela: async (ref: TabelaRef) =>
      tabelas.find((t) => t.schema === ref.schema && t.nome === ref.nome) ??
      null,
    descreverSchema: async (schema: string) =>
      tabelas.filter((t) => t.schema === schema),
    amostrar: async () => ({
      colunas: [],
      linhas: [],
      temMais: false,
      tempoMs: 0,
    }),
    perfilarColuna: async () => ({
      linhasAnalisadas: 100,
      preenchidas: 90,
      distintos: 3,
      minimo: "A",
      maximo: "C",
      tamanhoMinimo: 1,
      tamanhoMaximo: 1,
      maisComuns: [{ valor: "A", quantidade: 50 }],
      formatos: [{ formato: "A", quantidade: 90 }],
      tempoMs: 1,
    }),
    buscarColunas: async () => [],
    lerMapeado: async (pedido) => {
      leituras.push(pedido);
      return linhas;
    },
    esquecerEstrutura: () => {},
    explicarFalha: () => "falhou",
  };
  const deps: Dependencias = {
    banco,
    vocabulario: {
      nome: "Winthor",
      tabela: () => null,
      coluna: () => null,
      perfis: (tipo) => (tipo === "preco" ? perfisDePreco : []),
    },
    repositorio: {
      carregar: async () => salvo,
      salvar: async (mapeamento) => {
        salvo = mapeamento;
      },
    },
    nerp: {
      codigosExistentes: async (_tipo, codigos) =>
        new Set(codigos.filter((codigo) => codigo === "108238")),
    },

    destino: {
      produtosLocais: async () => [],
      aplicarProdutos: async () => ({ gravados: 0, falhas: [] }),
      clientesLocais: async () => [],
      aplicarClientes: async () => ({ gravados: 0, falhas: [] }),
      produtosVinculados: async () => new Map(),
      filialDoEstoque: async () => null,
      substituirEstoque: async () => ({ produtosAtualizados: 0 }),
    },
  };
  return { deps, leituras, salvo: () => salvo };
}

describe("sugerirMapeamento", () => {
  it("cai para o preço pelas vendas quando a tabela de preço não está acessível", async () => {
    const { deps } = montar();
    const sugestao = await sugerirMapeamento(deps, "preco");
    expect(sugestao.perfil?.chave).toBe("vendas");
    expect(sugestao.origem?.juncao?.tabela.nome).toBe("PCPEDC");
    expect(sugestao.recusados).toEqual([
      {
        perfil: "Tabela de preço",
        motivo:
          "PCTABPR: sem permissão (a tabela não aparece para esta credencial).",
      },
    ]);
  });

  it("diz que não há perfil quando o ERP não tem um para o tipo", async () => {
    const { deps } = montar();
    const sugestao = await sugerirMapeamento(deps, "categoria");
    expect(sugestao.origem).toBeNull();
    expect(sugestao.recusados).toEqual([]);
  });
});

describe("testarMapeamento", () => {
  it("converte as linhas e confere o código no NERP", async () => {
    const { deps, leituras } = montar([
      { codigoProduto: 108238, preco: 21.454, regiao: 11, data: null },
      { codigoProduto: 999, preco: 4.294, regiao: 9, data: null },
    ]);
    const resultado = await testarMapeamento(deps, "preco", null, "108238");

    expect(resultado.tipo.status).toBe("pronto");
    expect(leituras[0].codigo).toBe("108238");
    expect(leituras[0].diasNoMaximo).toBeNull();
    expect(resultado.linhas[0].valores.preco).toBe(21.454);
    expect(resultado.linhas.map((linha) => linha.existeNoNerp)).toEqual([
      true,
      false,
    ]);
  });

  it("sem código, encurta a janela para não pesar no ERP", async () => {
    const { deps, leituras } = montar([]);
    await testarMapeamento(deps, "preco", null, null);
    expect(leituras[0].diasNoMaximo).toBe(3);
  });

  it("não lê nada quando o tipo não está pronto", async () => {
    const { deps, leituras } = montar([]);
    const resultado = await testarMapeamento(deps, "promocao", null, null);
    expect(resultado.tipo.status).toBe("indisponivel");
    expect(leituras).toEqual([]);
  });
});

describe("salvarMapeamento", () => {
  it("recusa manual inválido e não grava", async () => {
    const { deps, salvo } = montar();
    await expect(
      salvarMapeamento(deps, "estoque", {
        modo: "manual",
        origem: {
          tabela: { schema: "LGCARVALHO", nome: "PCEST" },
          colunas: { codigoProduto: { de: "base", nome: "CODPROD" } },
          conversoes: {},
          filtros: [],
        },
      }),
    ).rejects.toBeInstanceOf(MapeamentoInvalido);
    expect(salvo().tipos.estoque.modo).toBe("auto");
  });

  it("grava manual válido sem mexer nos outros tipos", async () => {
    const { deps, salvo } = montar();
    const resumo = await salvarMapeamento(deps, "estoque", {
      modo: "manual",
      origem: {
        tabela: { schema: "LGCARVALHO", nome: "PCEST" },
        colunas: {
          codigoProduto: { de: "base", nome: "CODPROD" },
          filial: { de: "base", nome: "CODFILIAL" },
          quantidade: { de: "base", nome: "QTESTGER" },
        },
        conversoes: {},
        filtros: [],
      },
    });
    expect(resumo.status).toBe("pronto");
    expect(salvo().tipos.estoque.origem?.tabela.nome).toBe("PCEST");
    expect(salvo().tipos.preco.modo).toBe("auto");
  });
});
