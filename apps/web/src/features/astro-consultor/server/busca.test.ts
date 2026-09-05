import {
  buscarFerramentas,
  CONSULTOR_TOOL_IDS,
  detalharFerramenta,
  detalharSegmento,
  explicarMetodo,
  resolverIdsDeFerramentas,
} from "@nerp/site-content";
import { describe, expect, it } from "vitest";
import { buscarComAFalaDoVisitante } from "./busca";

/**
 * A busca do consultor é determinística de propósito: é ela que decide QUAIS
 * ferramentas o modelo pode citar. Se ela erra, o modelo recomenda a coisa
 * errada com toda a confiança do mundo — e nenhum teste de prompt pega isso.
 */

/** Os ids recomendados, na ordem em que a busca os devolveu. */
function idsPara(dor: string, extra: { segmento?: string } = {}) {
  return buscarFerramentas({ dor, ...extra }).map((item) => item.id);
}

describe("buscarFerramentas", () => {
  it("casa a dor do cliente com a ferramenta, pelas palavras dele", () => {
    const ids = idsPara("meu preço na gôndola não bate com o do caixa");
    expect(ids).toContain("qr-preco");
    expect(ids.length).toBeGreaterThan(0);
  });

  it("acha o CRM por 'vendedores' mesmo o catálogo dizendo 'vendedor'", () => {
    const ids = idsPara("não consigo acompanhar meus vendedores");
    expect(ids.some((id) => id === "tracking" || id === "ranking")).toBe(true);
  });

  it("acha o encarte pelo nome que o varejo usa", () => {
    expect(idsPara("perco tempo montando o encarte da semana")).toContain(
      "catalogo-promocional",
    );
  });

  it("ignora acento e caixa", () => {
    expect(idsPara("INVENTÁRIO")).toEqual(idsPara("inventario"));
  });

  it("não devolve nada quando a frase só tem palavra vazia", () => {
    expect(buscarFerramentas({ dor: "eu preciso de mais isso aqui" })).toEqual(
      [],
    );
  });

  it("respeita o limite e nunca passa do teto", () => {
    expect(buscarFerramentas({ dor: "estoque", limite: 2 })).toHaveLength(2);
    expect(
      buscarFerramentas({ dor: "loja", limite: 999 }).length,
    ).toBeLessThanOrEqual(12);
  });

  it("sem dor, lista as ferramentas do segmento", () => {
    const ids = buscarFerramentas({ segmento: "supermercados" }).map(
      (i) => i.id,
    );
    expect(ids).toContain("pdv");
    expect(ids.every((id) => CONSULTOR_TOOL_IDS.includes(id))).toBe(true);
  });

  it("o segmento empurra, não filtra: a dor de fora dele ainda aparece", () => {
    const ids = idsPara("preciso emitir proposta e contrato", {
      segmento: "supermercados",
    });
    expect(ids).toContain("forge");
  });

  it("a categoria filtra de verdade", () => {
    const achados = buscarFerramentas({ dor: "loja", categoria: "marketing" });
    expect(achados.every((item) => item.categoria === "marketing")).toBe(true);
  });

  it("só devolve ferramenta que existe no catálogo", () => {
    const ids = idsPara("quero organizar minha operação inteira");
    expect(ids.every((id) => CONSULTOR_TOOL_IDS.includes(id))).toBe(true);
  });

  it("diz por que recomendou", () => {
    const [primeiro] = buscarFerramentas({ dor: "gôndola e caixa" });
    expect(primeiro?.motivo.length).toBeGreaterThan(0);
  });

  it("corta a cauda longa: uma dor específica não vem com brinde", () => {
    // Sem piso de relevância, "encarte" trazia PDV e Forms de carona porque
    // uma palavra qualquer da descrição deles pontuava.
    const achados = buscarFerramentas({
      dor: "monto o encarte no Canva toda semana e demoro dois dias",
    });
    expect(achados[0]?.id).toBe("catalogo-promocional");
    expect(achados.map((a) => a.id)).not.toContain("forms");
    expect(achados.length).toBeLessThanOrEqual(3);
  });
});

describe("detalharFerramenta", () => {
  it("devolve null para id inventado, em vez de improvisar", () => {
    expect(detalharFerramenta("ferramenta-que-nao-existe")).toBeNull();
    expect(detalharFerramenta("")).toBeNull();
  });

  it("traz o par dor↔solução da página", () => {
    const tracking = detalharFerramenta("tracking");
    expect(tracking?.nome).toContain("Tracking");
    expect(tracking?.dores.length).toBeGreaterThan(0);
    expect(tracking?.ganhos.length).toBeGreaterThan(0);
    expect(tracking?.href).toBe("/solucoes/crm-tracking");
  });

  it("responde por todos os ids do índice", () => {
    for (const id of CONSULTOR_TOOL_IDS) {
      expect(detalharFerramenta(id), id).not.toBeNull();
    }
  });
});

describe("resolverIdsDeFerramentas", () => {
  // Um teste de regressão: numa conversa real o modelo mandou "Catálogo
  // Promocional" em vez de "catalogo-promocional", o filtro antigo descartou,
  // e o lead ficou sem escopo e com a estimativa só na base.
  it("aceita o nome que o modelo escreve, não só o id", () => {
    expect(
      resolverIdsDeFerramentas([
        "Catálogo Promocional",
        "ORBITA PDV",
        "estoque",
      ]),
    ).toEqual(["catalogo-promocional", "pdv", "estoque"]);
  });

  it("descarta o que não é ferramenta e não repete", () => {
    expect(
      resolverIdsDeFerramentas(["pdv", "pdv", "módulo de RH", ""]),
    ).toEqual(["pdv"]);
  });
});

describe("detalharSegmento", () => {
  it("devolve as ferramentas curadas, todas válidas", () => {
    const segmento = detalharSegmento("supermercados");
    expect(segmento?.ferramentas.length).toBeGreaterThan(0);
    expect(
      segmento?.ferramentas.every((f) => CONSULTOR_TOOL_IDS.includes(f.id)),
    ).toBe(true);
  });

  it("devolve null para segmento inventado", () => {
    expect(detalharSegmento("padarias")).toBeNull();
  });
});

describe("explicarMetodo", () => {
  it("sem argumento, traz as quatro etapas e o princípio", () => {
    const metodo = explicarMetodo();
    expect(metodo.etapas).toHaveLength(4);
    expect(metodo.etapas.map((e) => e.title)).toEqual([
      "Necessidade",
      "Análise",
      "Sistematização",
      "Ação",
    ]);
    expect(metodo.principio).toContain("não decidir antes de analisar");
  });

  it("escolhe a etapa pela posição — 'A' sozinho seria ambíguo", () => {
    expect(explicarMetodo(2).etapas[0].title).toBe("Análise");
    expect(explicarMetodo(4).etapas[0].title).toBe("Ação");
  });

  it("aceita o nome, com ou sem acento", () => {
    expect(explicarMetodo("Sistematização").etapas[0].mark).toBe("S");
    expect(explicarMetodo("acao").etapas[0].title).toBe("Ação");
  });

  it("etapa desconhecida devolve o método inteiro, não vazio", () => {
    expect(explicarMetodo("etapa-9").etapas).toHaveLength(4);
  });
});

describe("buscarComAFalaDoVisitante", () => {
  // Regressão de uma conversa real: o visitante disse "o encarte da semana
  // demora dois dias" e o modelo buscou por "criação de materiais
  // promocionais". A busca devolveu Pages e Planner — certos para o texto que
  // recebeu, errados para a dor de quem estava do outro lado.
  const FALA =
    "tenho um supermercado o encarte da semana demora dois dias pra ficar pronto sim pode buscar";

  it("a fala do visitante ganha da paráfrase do modelo", () => {
    const ids = buscarComAFalaDoVisitante(
      { dor: "criação de materiais promocionais" },
      FALA,
    ).map((item) => item.id);

    expect(ids[0]).toBe("catalogo-promocional");
    expect(ids).not.toContain("pages");
  });

  it("sem fala guardada, vale o que o modelo passou", () => {
    const ids = buscarComAFalaDoVisitante({ dor: "encarte" }, "").map(
      (item) => item.id,
    );
    expect(ids).toContain("catalogo-promocional");
  });

  it("o que o modelo achou completa, sem repetir", () => {
    const achados = buscarComAFalaDoVisitante(
      { dor: "proposta e contrato" },
      FALA,
    );
    const ids = achados.map((item) => item.id);
    expect(ids).toContain("catalogo-promocional"); // veio da fala
    expect(ids).toContain("forge"); // veio do modelo
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("respeita o limite mesmo somando as duas buscas", () => {
    expect(
      buscarComAFalaDoVisitante({ dor: "loja estoque venda", limite: 3 }, FALA),
    ).toHaveLength(3);
  });
});
