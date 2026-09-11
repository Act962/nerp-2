import { describe, expect, it } from "vitest";
import type { AstroPricing } from "@/features/astro-consultor/server/preco";
import { compararComAvulso, economiaPercentual } from "./comparativo";

/**
 * O comparativo é argumento de venda com número. Um número errado aqui não
 * quebra tela nenhuma — vira uma promessa que o cliente confere com a fatura
 * dele e descobre que não fecha.
 */

function tabela(
  modulos: { toolId: string; minCents: number; maxCents: number }[],
  ativo = true,
): AstroPricing {
  return {
    ativo,
    disclaimer: "",
    portes: [],
    modulos,
    porLojaAdicional: { minCents: 0, maxCents: 0 },
    teto: { minCents: 0, maxCents: 0 },
    setup: { minCents: 0, maxCents: 0, texto: "" },
  };
}

describe("compararComAvulso", () => {
  it("soma o mínimo e o máximo das ferramentas que têm preço", () => {
    const r = compararComAvulso(
      tabela([
        { toolId: "pdv", minCents: 19_900, maxCents: 29_900 },
        { toolId: "whatsapp", minCents: 9_900, maxCents: 59_900 },
      ]),
      ["pdv", "whatsapp"],
    );
    expect(r).toEqual({
      disponivel: true,
      minCents: 29_800,
      maxCents: 89_800,
      ferramentas: 2,
      semPreco: 0,
    });
  });

  it("conta quantas ficaram de fora — a tela não pode dizer 'todas'", () => {
    // Astro, Financeiro e Pedidos não existem no catálogo do site.
    const r = compararComAvulso(
      tabela([{ toolId: "pdv", minCents: 19_900, maxCents: 29_900 }]),
      ["pdv", "astro", "financeiro"],
    );
    expect(r.disponivel).toBe(true);
    if (!r.disponivel) return;
    expect(r.ferramentas).toBe(1);
    expect(r.semPreco).toBe(2);
  });

  it("ferramenta repetida não conta duas vezes", () => {
    const r = compararComAvulso(
      tabela([{ toolId: "pdv", minCents: 10_000, maxCents: 10_000 }]),
      ["pdv", "pdv", "pdv"],
    );
    expect(r.disponivel).toBe(true);
    if (r.disponivel) expect(r.minCents).toBe(10_000);
  });

  it("tabela desligada não produz número nenhum", () => {
    // Preço inventado num argumento de venda vira promessa comercial.
    const r = compararComAvulso(
      tabela([{ toolId: "pdv", minCents: 19_900, maxCents: 29_900 }], false),
      ["pdv"],
    );
    expect(r).toEqual({ disponivel: false, motivo: "sem_tabela" });
  });

  it("tabela ausente ou vazia também não", () => {
    expect(compararComAvulso(null, ["pdv"]).disponivel).toBe(false);
    expect(compararComAvulso(undefined, ["pdv"]).disponivel).toBe(false);
    expect(compararComAvulso(tabela([]), ["pdv"])).toEqual({
      disponivel: false,
      motivo: "sem_tabela",
    });
  });

  it("nenhuma das ferramentas do plano tem preço", () => {
    const r = compararComAvulso(
      tabela([{ toolId: "outra", minCents: 100, maxCents: 200 }]),
      ["pdv", "estoque"],
    );
    expect(r).toEqual({ disponivel: false, motivo: "sem_modulos" });
  });
});

describe("economiaPercentual", () => {
  const comparativo = compararComAvulso(
    tabela([
      { toolId: "pdv", minCents: 30_000, maxCents: 50_000 },
      { toolId: "whatsapp", minCents: 20_000, maxCents: 40_000 },
    ]),
    ["pdv", "whatsapp"],
  );

  it("calcula sobre o PISO do avulso, não sobre a média", () => {
    // R$ 500 no piso contra R$ 397 do plano = 21%.
    expect(economiaPercentual(comparativo, 39_700)).toBe(21);
  });

  it("plano mais caro que o avulso não vira economia", () => {
    // Economia que não existe se descobre na primeira conta que o cliente faz.
    expect(economiaPercentual(comparativo, 60_000)).toBeNull();
    expect(economiaPercentual(comparativo, 50_000)).toBeNull();
  });

  it("sem comparativo, sem economia", () => {
    expect(
      economiaPercentual({ disponivel: false, motivo: "sem_tabela" }, 39_700),
    ).toBeNull();
  });

  it("plano sem preço não calcula", () => {
    expect(economiaPercentual(comparativo, null)).toBeNull();
    expect(economiaPercentual(comparativo, 0)).toBeNull();
  });
});
