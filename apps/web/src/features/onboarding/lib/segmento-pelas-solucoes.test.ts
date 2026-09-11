import { describe, expect, it } from "vitest";
import { SEGMENT_DEFAULT_DISABLED } from "@/lib/org-segment";
import { INTERESSES_PADRAO } from "./nichos";
import { segmentoPelasSolucoes } from "./segmento-pelas-solucoes";
import type { SolucaoId } from "./solucoes";

/**
 * O segmento deduzido decide quais módulos nascem ESCONDIDOS. Deduzir mal não
 * bloqueia nada — o dono liga de volta —, mas esconder no primeiro minuto o
 * que a pessoa quer ver é a pior primeira impressão possível. Por isso a
 * maioria dos casos aqui cobra CAUTELA, e não acerto fino.
 */

const nada: SolucaoId[] = [];

describe("quem opera a própria loja", () => {
  it("frente de caixa e catálogo dizem varejo", () => {
    expect(segmentoPelasSolucoes(["pdv", "catalogo-promocional"])).toEqual({
      segmento: "VAREJO",
      motivo: "varejo",
    });
  });

  it("o conjunto padrão do onboarding cai em varejo", () => {
    // É o que "Outro" e "Pular" pré-marcam: precisa levar ao segmento que não
    // esconde nada.
    const { segmento } = segmentoPelasSolucoes(INTERESSES_PADRAO);
    expect(segmento).toBe("VAREJO");
    expect(SEGMENT_DEFAULT_DISABLED[segmento]).toEqual([]);
  });
});

describe("quem trabalha o ponto de venda dos outros", () => {
  it("trade sem estoque é indústria", () => {
    expect(segmentoPelasSolucoes(["trade", "book", "tradegram"])).toEqual({
      segmento: "INDUSTRIA",
      motivo: "trade-sem-estoque",
    });
  });

  it("trade COM estoque é distribuidor — quem segura mercadoria", () => {
    expect(segmentoPelasSolucoes(["trade", "book", "estoque"])).toEqual({
      segmento: "DISTRIBUIDOR",
      motivo: "trade-com-estoque",
    });
  });

  it("agência nunca é deduzida: é a que mais esconde", () => {
    // Indústria e agência usam as MESMAS telas; nada nas soluções separa as
    // duas. Chutar agência tiraria produtos e estoque de quem os tem.
    const combinacoes: SolucaoId[][] = [
      ["trade"],
      ["trade", "tradegram"],
      ["book", "planograma", "ranking"],
      ["trade", "book", "tradegram", "planograma", "ranking"],
    ];
    for (const marcadas of combinacoes) {
      expect(segmentoPelasSolucoes(marcadas).segmento).not.toBe("AGENCIA");
    }
  });
});

describe("quando não dá para saber", () => {
  it("sem nada marcado, não há sinal", () => {
    expect(segmentoPelasSolucoes(nada)).toEqual({
      segmento: "OUTRO",
      motivo: "sem-sinal",
    });
  });

  it("só o que serve a todo mundo não vota", () => {
    // WhatsApp, financeiro, agenda e o Astro não dizem de que lado a pessoa
    // está — uma clínica e uma indústria marcam os mesmos.
    expect(
      segmentoPelasSolucoes(["whatsapp", "financeiro", "agenda", "astro"]),
    ).toEqual({ segmento: "OUTRO", motivo: "sem-sinal" });
  });

  it("empate entre os dois lados devolve o segmento que não esconde nada", () => {
    const { segmento } = segmentoPelasSolucoes(["pdv", "trade"]);
    expect(segmento).toBe("OUTRO");
    expect(SEGMENT_DEFAULT_DISABLED[segmento]).toEqual([]);
  });

  it("estoque sozinho não decide nada", () => {
    // Supermercado, clínica e oficina têm estoque do mesmo jeito: ele só
    // desempata DENTRO do trade.
    expect(segmentoPelasSolucoes(["estoque"]).segmento).toBe("OUTRO");
  });
});

describe("o que a dedução nunca esconde", () => {
  it("nenhum segmento deduzido esconde o Astro nem as configurações", () => {
    const casos: SolucaoId[][] = [
      ["pdv"],
      ["trade", "book"],
      ["trade", "estoque"],
      [],
    ];
    for (const marcadas of casos) {
      const { segmento } = segmentoPelasSolucoes(marcadas);
      const escondidos: string[] = SEGMENT_DEFAULT_DISABLED[segmento];
      expect(escondidos).not.toContain("configuracoes");
      expect(escondidos).not.toContain("dashboard");
    }
  });
});
