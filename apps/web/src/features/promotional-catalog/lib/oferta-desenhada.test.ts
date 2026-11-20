import { describe, expect, it } from "vitest";
import {
  type OfertaDesenhada,
  type PedidoDeOferta,
  aplicarDesenho,
  pedidoDeOfertaSchema,
  tokensEstimados,
} from "./oferta-desenhada";

const pedido: PedidoDeOferta = {
  formato: "story",
  produtoIds: ["a", "b", "c"],
  oferta: { nome: "Rasga Outubro" },
  clima: "minimalista",
  corBase: "#0676b7",
  molde: "grade",
};

const desenho: OfertaDesenhada = {
  molde: "destaque",
  clima: "impacto",
  corBase: "#ff0000",
  chamada: "Preços que rasgam a etiqueta",
  ordem: ["c", "x", "a", "c"],
};

describe("aplicarDesenho", () => {
  it("a IA só reordena: some o estranho, repetido sai, esquecido vai pro fim", () => {
    expect(aplicarDesenho(pedido, desenho, true).produtoIds).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("sem estilo livre, clima e cor continuam os do usuário", () => {
    const e = aplicarDesenho(pedido, desenho, false);
    expect(e.clima).toBe("minimalista");
    expect(e.corBase).toBe("#0676b7");
    expect(e.molde).toBe("destaque");
    expect(e.oferta.chamada).toBe("Preços que rasgam a etiqueta");
  });

  it("com estilo livre, vale o da IA — cor inválida não passa", () => {
    expect(aplicarDesenho(pedido, desenho, true).clima).toBe("impacto");
    expect(
      aplicarDesenho(pedido, { ...desenho, corBase: "vermelho" }, true).corBase,
    ).toBe("#0676b7");
  });

  it("chamada digitada pelo usuário manda", () => {
    const e = aplicarDesenho(
      { ...pedido, oferta: { nome: "X", chamada: "Só hoje" } },
      desenho,
      true,
    );
    expect(e.oferta.chamada).toBe("Só hoje");
  });
});

describe("pedidoDeOfertaSchema", () => {
  it("aceita o que o assistente manda e recusa sem produto", () => {
    expect(pedidoDeOfertaSchema.safeParse(pedido).success).toBe(true);
    expect(
      pedidoDeOfertaSchema.safeParse({ ...pedido, produtoIds: [] }).success,
    ).toBe(false);
  });
});

it("estimativa cresce com os produtos", () => {
  expect(tokensEstimados(10).tokensIn).toBeGreaterThan(
    tokensEstimados(1).tokensIn,
  );
});
