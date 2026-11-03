import { describe, expect, it } from "vitest";
import { ALVOS } from "./alvos";
import { podeFiltrarOuOrdenarPor } from "./estrutura";
import { PCPEDC, PCPEDI, PCPRODUT } from "./fixtures";
import {
  type Origem,
  lerMapeamento,
  mapeamentoSchema,
  origemSchema,
  validarOrigem,
} from "./mapeamento";

const LG = "LGCARVALHO";

function origemProduto(extra: Partial<Origem> = {}): Origem {
  return origemSchema.parse({
    tabela: { schema: LG, nome: "PCPRODUT" },
    colunas: {
      codigo: { de: "base", nome: "CODPROD" },
      nome: { de: "base", nome: "DESCRICAO" },
    },
    ...extra,
  });
}

function origemPrecoPelasVendas(extra: Partial<Origem> = {}): Origem {
  return origemSchema.parse({
    tabela: { schema: LG, nome: "PCPEDI" },
    juncao: {
      tabela: { schema: LG, nome: "PCPEDC" },
      de: "NUMPED",
      para: "NUMPED",
    },
    colunas: {
      codigoProduto: { de: "base", nome: "CODPROD" },
      preco: { de: "base", nome: "PTABELA" },
      regiao: { de: "juncao", nome: "NUMREGIAO" },
      data: { de: "base", nome: "DATA" },
    },
    janela: { coluna: { de: "base", nome: "DATA" }, dias: 90 },
    ...extra,
  });
}

describe("lerMapeamento", () => {
  it("devolve tudo automático quando não há nada salvo", () => {
    const mapeamento = lerMapeamento(null);
    expect(mapeamento.versao).toBe(1);
    expect(mapeamento.tipos.preco.modo).toBe("auto");
    expect(mapeamento.tipos.categoria.modo).toBe("auto");
  });

  it("não lança com JSON inválido e cai no vazio", () => {
    expect(lerMapeamento({ versao: 99, tipos: "x" }).tipos.produto.modo).toBe(
      "auto",
    );
  });

  it("recusa modo manual sem origem", () => {
    const lido = mapeamentoSchema.safeParse({
      tipos: { produto: { modo: "manual" } },
    });
    expect(lido.success).toBe(false);
  });

  it("guarda a origem manual", () => {
    const mapeamento = lerMapeamento({
      tipos: { estoque: { modo: "manual", origem: origemProduto() } },
    });
    expect(mapeamento.tipos.estoque.origem?.tabela.nome).toBe("PCPRODUT");
    expect(mapeamento.tipos.produto.modo).toBe("auto");
  });
});

describe("validarOrigem", () => {
  it("aceita o produto padrão do Winthor", () => {
    const diagnostico = validarOrigem(ALVOS.produto, origemProduto(), {
      base: PCPRODUT,
      juncao: null,
    });
    expect(diagnostico.erros).toEqual([]);
  });

  it("acusa campo obrigatório faltando", () => {
    const origem = origemProduto({
      colunas: { codigo: { de: "base", nome: "CODPROD" } },
    });
    const { erros } = validarOrigem(ALVOS.produto, origem, {
      base: PCPRODUT,
      juncao: null,
    });
    expect(erros).toContain('"Nome" é obrigatório.');
  });

  it("acusa coluna que não existe", () => {
    const origem = origemProduto({
      colunas: {
        codigo: { de: "base", nome: "CODPROD" },
        nome: { de: "base", nome: "NAOEXISTE" },
      },
    });
    const { erros } = validarOrigem(ALVOS.produto, origem, {
      base: PCPRODUT,
      juncao: null,
    });
    expect(erros[0]).toContain("NAOEXISTE");
  });

  it("exige conversão em campo booleano", () => {
    const origem = origemProduto({
      colunas: {
        codigo: { de: "base", nome: "CODPROD" },
        nome: { de: "base", nome: "DESCRICAO" },
        ativo: { de: "base", nome: "DTEXCLUSAO" },
      },
    });
    const semConversao = validarOrigem(ALVOS.produto, origem, {
      base: PCPRODUT,
      juncao: null,
    });
    expect(semConversao.erros.join()).toContain("precisa de uma conversão");

    const comConversao = validarOrigem(
      ALVOS.produto,
      { ...origem, conversoes: { ativo: "vazioEhVerdadeiro" } },
      { base: PCPRODUT, juncao: null },
    );
    expect(comConversao.erros).toEqual([]);
  });

  it("recusa número vindo de data e avisa número vindo de texto", () => {
    const deData = validarOrigem(
      ALVOS.produto,
      origemProduto({
        colunas: {
          codigo: { de: "base", nome: "CODPROD" },
          nome: { de: "base", nome: "DESCRICAO" },
          unidadesPorCaixa: { de: "base", nome: "DTEXCLUSAO" },
        },
      }),
      { base: PCPRODUT, juncao: null },
    );
    expect(deData.erros.join()).toContain("espera numero");

    const deTexto = validarOrigem(
      ALVOS.produto,
      origemProduto({
        colunas: {
          codigo: { de: "base", nome: "CODPROD" },
          nome: { de: "base", nome: "DESCRICAO" },
          unidadesPorCaixa: { de: "base", nome: "UNIDADE" },
        },
      }),
      { base: PCPRODUT, juncao: null },
    );
    expect(deTexto.erros).toEqual([]);
    expect(deTexto.avisos.join()).toContain("pode falhar");
  });

  it("só aceita conversão que combina com o tipo do campo", () => {
    const comConversao = (conversoes: Record<string, string>) =>
      validarOrigem(
        ALVOS.produto,
        origemProduto({
          colunas: {
            codigo: { de: "base", nome: "CODPROD" },
            nome: { de: "base", nome: "DESCRICAO" },
            ean: { de: "base", nome: "CODAUXILIAR" },
            unidadesPorCaixa: { de: "base", nome: "QTUNITCX" },
          },
          conversoes: conversoes as Origem["conversoes"],
        }),
        { base: PCPRODUT, juncao: null },
      ).erros;
    expect(comConversao({ ean: "gtinValido" })).toEqual([]);
    expect(comConversao({ ean: "vazioEhVerdadeiro" }).join()).toContain(
      "não aceita a conversão",
    );
    expect(
      comConversao({ unidadesPorCaixa: "somenteDigitos" }).join(),
    ).toContain("não aceita a conversão");
  });

  it("aceita preço pelas vendas com junção e janela", () => {
    const { erros } = validarOrigem(ALVOS.preco, origemPrecoPelasVendas(), {
      base: PCPEDI,
      juncao: PCPEDC,
    });
    expect(erros).toEqual([]);
  });

  it("exige janela de data em tabela grande", () => {
    const origem = { ...origemPrecoPelasVendas(), janela: undefined };
    const { erros } = validarOrigem(ALVOS.preco, origem, {
      base: PCPEDI,
      juncao: PCPEDC,
    });
    expect(erros.join()).toContain("defina uma janela de data");
  });

  it("recusa janela em coluna sem índice de tabela grande", () => {
    const pedi = {
      ...PCPEDI,
      colunas: PCPEDI.colunas.map((c) =>
        c.nome === "DATA" ? { ...c, indiceLider: false } : c,
      ),
    };
    const { erros } = validarOrigem(ALVOS.preco, origemPrecoPelasVendas(), {
      base: pedi,
      juncao: PCPEDC,
    });
    expect(erros.join()).toContain("não abre nenhum índice");
  });

  it("acusa junção para tabela inacessível", () => {
    const { erros } = validarOrigem(ALVOS.preco, origemPrecoPelasVendas(), {
      base: PCPEDI,
      juncao: null,
    });
    expect(erros.join()).toContain("não está acessível");
  });

  it("acusa campo que não pertence ao tipo", () => {
    const origem = origemProduto({
      colunas: {
        codigo: { de: "base", nome: "CODPROD" },
        nome: { de: "base", nome: "DESCRICAO" },
        preco: { de: "base", nome: "QTUNITCX" },
      },
    });
    const { erros } = validarOrigem(ALVOS.produto, origem, {
      base: PCPRODUT,
      juncao: null,
    });
    expect(erros).toContain('"preco" não é um campo de Produto.');
  });
});

describe("podeFiltrarOuOrdenarPor", () => {
  it("libera qualquer coluna em tabela pequena", () => {
    expect(podeFiltrarOuOrdenarPor(PCPRODUT, "DESCRICAO").ok).toBe(true);
  });

  it("em tabela grande só libera índice líder", () => {
    expect(podeFiltrarOuOrdenarPor(PCPEDI, "DATA").ok).toBe(true);
    const semIndice = podeFiltrarOuOrdenarPor(PCPEDI, "PTABELA");
    expect(semIndice.ok).toBe(false);
    if (!semIndice.ok) expect(semIndice.motivo).toContain("16.993.357");
  });

  it("acusa coluna inexistente", () => {
    expect(podeFiltrarOuOrdenarPor(PCPRODUT, "XYZ").ok).toBe(false);
  });
});
