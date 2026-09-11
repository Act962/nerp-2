import { describe, expect, it } from "vitest";
import { normalizar, reconhecerPergunta } from "./reconhecer";

/**
 * O risco deste arquivo não é deixar de reconhecer — é reconhecer errado.
 * Uma frase que cai no atalho errado é respondida com total confiança, e a
 * pessoa não tem como saber. Por isso metade dos casos aqui são de RECUSA.
 */

describe("normalizar", () => {
  it("tira acento, caixa e pontuação", () => {
    expect(normalizar("Quantos PRODUTOS eu tenho?")).toBe(
      "quantos produtos eu tenho",
    );
    expect(normalizar("  Qual  é   o ticket médio? ")).toBe(
      "qual e o ticket medio",
    );
  });
});

describe("perguntas que o atalho responde", () => {
  const casos: [string, string][] = [
    ["quantos produtos eu tenho", "contarProdutos"],
    ["Quantos produtos?", "contarProdutos"],
    ["quantos produtos cadastrados", "contarProdutos"],
    ["quantos clientes eu tenho", "contarClientes"],
    ["quantos fornecedores temos", "contarFornecedores"],
    ["quantas lojas eu tenho", "contarLojas"],
    ["quantas stars eu tenho", "saldoDeStars"],
    ["qual o meu saldo", "saldoDeStars"],
    ["quantos catalogos eu criei", "contarCatalogos"],
    ["quantos produtos estao com estoque baixo", "contarEstoqueBaixo"],
  ];

  for (const [frase, esperado] of casos) {
    it(`"${frase}" → ${esperado}`, () => {
      expect(reconhecerPergunta(frase)?.atalho).toBe(esperado);
    });
  }
});

describe("perguntas com período", () => {
  it("lê o período da frase", () => {
    expect(reconhecerPergunta("quanto eu vendi hoje")).toEqual({
      atalho: "resumoDeVendas",
      periodo: "hoje",
    });
    expect(reconhecerPergunta("quanto vendi ontem")).toEqual({
      atalho: "resumoDeVendas",
      periodo: "ontem",
    });
    expect(
      reconhecerPergunta("qual o ticket medio nos ultimos 7 dias"),
    ).toEqual({ atalho: "ticketMedio", periodo: "7d" });
    expect(reconhecerPergunta("qual produto mais vendeu este mes")).toEqual({
      atalho: "produtoMaisVendido",
      periodo: "mes",
    });
    expect(reconhecerPergunta("o que mais saiu mes passado")).toEqual({
      atalho: "produtoMaisVendido",
      periodo: "mes_anterior",
    });
  });

  it("SEM período, recusa — a pergunta é ambígua", () => {
    // "Quanto vendi" pode ser hoje, o mês ou o ano. O modelo pergunta de
    // volta; o atalho não sabe perguntar.
    expect(reconhecerPergunta("quanto eu vendi")).toBeNull();
    expect(reconhecerPergunta("qual o ticket medio")).toBeNull();
  });
});

describe("o que o atalho RECUSA", () => {
  it("continuação do turno anterior", () => {
    // "E ontem?" só significa algo depois de outra pergunta.
    expect(reconhecerPergunta("e ontem?")).toBeNull();
    expect(reconhecerPergunta("e quantos clientes?")).toBeNull();
    expect(reconhecerPergunta("entao quanto vendi hoje")).toBeNull();
  });

  it("duas perguntas numa só", () => {
    expect(
      reconhecerPergunta("quanto vendi hoje e qual produto mais saiu"),
    ).toBeNull();
    expect(
      reconhecerPergunta("quantos produtos e quantos clientes eu tenho"),
    ).toBeNull();
  });

  it("pergunta que se refere a algo já dito", () => {
    expect(reconhecerPergunta("quantos produtos tem esse catalogo")).toBeNull();
    expect(reconhecerPergunta("quanto ele vendeu hoje")).toBeNull();
  });

  it("pedido de ação, que nunca é atalho", () => {
    expect(reconhecerPergunta("cria um catalogo com as promocoes")).toBeNull();
    expect(reconhecerPergunta("manda uma campanha hoje")).toBeNull();
  });

  it("pergunta parecida mas diferente", () => {
    // Conta produto do catálogo, não do cadastro.
    expect(
      reconhecerPergunta("quantos produtos entram no catalogo"),
    ).toBeNull();
    // Pede análise, não contagem.
    expect(reconhecerPergunta("quantos produtos devo comprar")).toBeNull();
    expect(reconhecerPergunta("por que vendi pouco hoje")).toBeNull();
  });

  it("texto longo demais não é pergunta fechada", () => {
    expect(reconhecerPergunta("a".repeat(200))).toBeNull();
  });

  it("vazio", () => {
    expect(reconhecerPergunta("")).toBeNull();
    expect(reconhecerPergunta("   ")).toBeNull();
  });
});
