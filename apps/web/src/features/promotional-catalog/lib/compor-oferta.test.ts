import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../types";
import {
  type EntradaOferta,
  acrescentarOferta,
  caberNaCaixa,
  catalogoDaOferta,
  comporOferta,
  contraste,
  encaixarGrade,
  formatoDoCatalogo,
  paletaDoClima,
} from "./compor-oferta";

let n = 0;
const base: EntradaOferta = {
  formato: "story",
  produtoIds: ["a", "b", "c"],
  oferta: { nome: "Rasga Outubro", validade: "2026-10-31T23:59" },
  clima: "impacto",
  molde: "grade",
  gerarId: () => `id${n++}`,
};

describe("comporOferta", () => {
  it("pagina pelo limite do formato (story = 6)", () => {
    const ids = Array.from({ length: 14 }, (_, i) => `p${i}`);
    const { pages } = comporOferta({ ...base, produtoIds: ids });
    expect(pages.map((p) => p.productIds?.length)).toEqual([6, 6, 2]);
    expect(pages.map((p) => p.name)).toEqual([
      "Rasga Outubro 1",
      "Rasga Outubro 2",
      "Rasga Outubro 3",
    ]);
  });

  it("título, validade e preço Por entram na página", () => {
    const { pages, offerOverrides } = comporOferta({
      ...base,
      precosPor: { a: 9.9, zz: 1, b: 0 },
    });
    const textos = pages[0].texts?.map((t) => t.text) ?? [];
    expect(textos).toContain("Rasga Outubro");
    expect(textos.some((t) => t.includes("31/10"))).toBe(true);
    expect(pages[0].offerValidUntil).toBe("2026-10-31T23:59");
    // Só produtos da oferta e preços válidos.
    expect(offerOverrides).toEqual({ a: 9.9 });
  });

  it("os grupos cabem na página em todos os formatos", () => {
    for (const formato of ["a4", "story", "feed"] as const) {
      const { pages, configBase } = comporOferta({
        ...base,
        formato,
        produtoIds: Array.from({ length: 12 }, (_, i) => `p${i}`),
      });
      const H = configBase.pageAspect
        ? 1080 / configBase.pageAspect
        : formato === "story"
          ? 1920
          : 1440;
      for (const pg of pages)
        for (const g of pg.productGroups ?? []) {
          expect(g.rect.x).toBeGreaterThanOrEqual(0);
          expect(g.rect.x + g.rect.w).toBeLessThanOrEqual(1080);
          expect(g.rect.y + g.rect.h).toBeLessThanOrEqual(H);
        }
    }
  });

  it("molde destaque: 1 herói + grade com o resto", () => {
    const { pages } = comporOferta({ ...base, molde: "destaque" });
    const [heroi, resto] = pages[0].productGroups ?? [];
    expect(heroi.productIds).toEqual(["a"]);
    expect(resto.productIds).toEqual(["b", "c"]);
    expect(heroi.rect.w).toBeGreaterThan(resto.rect.w / 2);
  });

  it("logo da organização vira etiqueta dinâmica", () => {
    const { pages } = comporOferta({ ...base, logo: { tipo: "org" } });
    expect(pages[0].overlays[0].binding).toEqual({
      source: "org",
      variable: "org.logo",
    });
  });
});

describe("paletaDoClima", () => {
  it("cor inválida cai no padrão e o preço sempre se lê", () => {
    for (const clima of [
      "impacto",
      "feira",
      "elegante",
      "minimalista",
      "datas",
    ] as const)
      for (const cor of ["#ffffff", "#000000", "#ff0000", "nada", "#ffe600"]) {
        const p = paletaDoClima(clima, cor);
        expect(contraste(p.destaque, p.destaqueTexto)).toBeGreaterThanOrEqual(
          3,
        );
        expect(contraste(p.card, p.cardTexto)).toBeGreaterThanOrEqual(4.5);
      }
  });

  it("fundo vermelho troca o preço para amarelo", () => {
    expect(paletaDoClima("impacto", "#d50000").destaque).toBe("#ffe600");
  });
});

describe("encaixarGrade", () => {
  it("1 produto ocupa a área sem passar da altura", () => {
    const g = encaixarGrade(1, { x: 0, y: 0, w: 1000, h: 600 }, 0.78);
    expect(g.cols).toBe(1);
    expect(g.rect.h).toBeLessThanOrEqual(600);
  });
});

describe("montagem", () => {
  it("catálogo novo: produtos, ordem e formato", () => {
    const oferta = comporOferta({ ...base, formato: "feed" });
    const cfg = catalogoDaOferta(DEFAULT_CONFIG, oferta);
    expect(cfg.manuallyAddedIds).toEqual(["a", "b", "c"]);
    expect(cfg.pageAspect).toBe(0.8);
    expect(formatoDoCatalogo(cfg)).toBe("feed");
  });

  it("acrescentar: tira dos excluídos e mantém o que já havia", () => {
    const oferta = comporOferta({ ...base, precosPor: { a: 5 } });
    const cfg = acrescentarOferta(
      {
        ...DEFAULT_CONFIG,
        manuallyAddedIds: ["x"],
        excludedProductIds: ["a", "y"],
        offerOverrides: { x: 2 },
      },
      [],
      oferta,
    );
    expect(cfg.manuallyAddedIds).toEqual(["x", "a", "b", "c"]);
    expect(cfg.excludedProductIds).toEqual(["y"]);
    expect(cfg.offerOverrides).toEqual({ x: 2, a: 5 });
  });
});

describe("dentro de um catálogo aberto", () => {
  it("mantém a etiqueta do catálogo e encaixa pela proporção dele", () => {
    const { pages } = comporOferta({ ...base, proporcaoCard: 1.2 });
    expect(pages[0].cardLayout).toBeUndefined();
    const g = pages[0].productGroups?.[0];
    expect(g && g.rect.w / g.gridCols).toBeGreaterThan(0);
  });
});

describe("caberNaCaixa", () => {
  it("nome curto fica em uma linha no corpo cheio", () => {
    expect(caberNaCaixa("Ofertas", 1000, 120, 0.8, 2)).toEqual({
      fonte: 120,
      linhas: 1,
    });
  });

  it("'RASGA OUTUBRO' encolhe para caber numa linha", () => {
    const r = caberNaCaixa("RASGA OUTUBRO", 1000, 120, 0.8, 2);
    expect(r.linhas).toBe(1);
    expect(13 * r.fonte * 0.8).toBeLessThanOrEqual(1000);
  });

  it("nome longo vai para duas linhas em vez de ficar miúdo", () => {
    const r = caberNaCaixa("Semana do Cliente Supermercado", 1000, 120, 0.8, 2);
    expect(r.linhas).toBe(2);
    expect(r.fonte).toBeGreaterThan(60);
  });

  it("título na página não invade a chamada", () => {
    const { pages } = comporOferta({
      ...base,
      oferta: {
        nome: "Rasga Outubro",
        chamada: "Descontos incríveis em produtos para lavar roupas",
      },
    });
    const [t, c] = pages[0].texts ?? [];
    expect(t.y + t.h).toBeLessThanOrEqual(c.y);
    const g = pages[0].productGroups?.[0];
    expect(c.y + c.h).toBeLessThanOrEqual(g?.rect.y ?? 0);
  });
});

describe("molde premium (arte da IA)", () => {
  const premium = { ...base, arte: "org/catalogo/artes/a.png" };

  it("1 produto vira destaque: bloco único na zona de produtos, sem grade", () => {
    const { pages, configBase } = comporOferta({
      ...premium,
      produtoIds: ["a"],
    });
    const pg = pages[0];
    expect(pg.backgroundImage).toBe("org/catalogo/artes/a.png");
    expect(pg.productIds).toEqual([]);
    expect(pg.styleBlocks).toHaveLength(1);
    expect(pg.styleBlocks?.[0].productId).toBe("a");
    expect(pg.styleBlocks?.[0].y).toBeGreaterThanOrEqual(0.29 * 1920 - 1);
    expect(configBase.hideCardBackground).toBe(true);
  });

  it("vários produtos: um bloco por produto, dentro da página, sem sobrepor", () => {
    const { pages } = comporOferta({
      ...premium,
      produtoIds: ["a", "b", "c", "d", "e"],
    });
    const blocos = pages[0].styleBlocks ?? [];
    expect(blocos.map((b) => b.productId)).toEqual(["a", "b", "c", "d", "e"]);
    for (const b of blocos) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(1080);
      expect(b.y + b.h).toBeLessThanOrEqual(0.8 * 1920 + 1);
    }
    for (let i = 0; i < blocos.length; i++)
      for (let j = i + 1; j < blocos.length; j++) {
        const [a, b] = [blocos[i], blocos[j]];
        const sobrepoe =
          a.x < b.x + b.w &&
          b.x < a.x + a.w &&
          a.y < b.y + b.h &&
          b.y < a.y + a.h;
        expect(sobrepoe).toBe(false);
      }
  });

  it("a validade vai para o rodapé com o ano, e os produtos entram no catálogo", () => {
    const oferta = comporOferta(premium);
    const textos = oferta.pages[0].texts?.map((t) => t.text) ?? [];
    expect(textos.some((t) => t.includes("31.10.2026"))).toBe(true);
    expect(catalogoDaOferta(DEFAULT_CONFIG, oferta).manuallyAddedIds).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("etiqueta de preço salva", () => {
  const salva = {
    layout: [
      {
        id: "minha-etiqueta",
        kind: "var" as const,
        variable: "priceActive" as const,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
      },
    ],
    proporcao: 1.2,
  };

  it("grade: a página e o catálogo usam a etiqueta salva e a proporção dela", () => {
    const { pages, configBase } = comporOferta({ ...base, etiqueta: salva });
    expect(pages[0].cardLayout?.[0].id).toBe("minha-etiqueta");
    expect(configBase.cardAspectRatio).toBe(1.2);
  });

  it("premium: produto único usa a etiqueta salva na proporção dela, com fundo de card", () => {
    const { pages, configBase } = comporOferta({
      ...base,
      produtoIds: ["a"],
      arte: "x.png",
      etiqueta: salva,
    });
    const [b] = pages[0].styleBlocks ?? [];
    expect(b.cardLayout[0].id).toBe("minha-etiqueta");
    expect(b.w / b.h).toBeCloseTo(1.2, 1);
    expect(configBase.hideCardBackground).toBe(false);
  });
});
