import { describe, expect, it } from "vitest";
import { cardLayoutFromStyle, cardStyleLabel } from "./card-template";
import type { CatalogConfig } from "../types";

const ESTILOS: CatalogConfig["cardStyle"][] = [
  "standard",
  "compact",
  "list",
  "minimal",
  "countdown",
  "badge-hot",
];

describe("cardLayoutFromStyle", () => {
  it.each(ESTILOS)("%s gera elementos válidos", (estilo) => {
    const els = cardLayoutFromStyle(estilo);
    expect(els.length).toBeGreaterThan(0);
    for (const e of els) {
      // Coordenadas são FRAÇÃO do card: fora de 0..1 o elemento sai da etiqueta.
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.x + e.w).toBeLessThanOrEqual(1);
      expect(e.y + e.h).toBeLessThanOrEqual(1);
      expect(e.id).toBeTruthy();
      expect(e.kind).toBe("var");
    }
  });

  it.each(ESTILOS)("%s tem foto, nome e preço", (estilo) => {
    const vars = cardLayoutFromStyle(estilo).map((e) => e.variable);
    expect(vars).toContain("photo");
    expect(vars).toContain("name");
    expect(vars).toContain("priceActive");
  });

  it("ids são únicos (senão a seleção no editor se confunde)", () => {
    const els = cardLayoutFromStyle("standard");
    expect(new Set(els.map((e) => e.id)).size).toBe(els.length);
  });

  it("a foto fica atrás dos textos", () => {
    const els = cardLayoutFromStyle("standard");
    const foto = els.find((e) => e.variable === "photo");
    const preco = els.find((e) => e.variable === "priceActive");
    expect(foto?.z ?? 0).toBeLessThan(preco?.z ?? 0);
  });

  it("no standard os elementos não se sobrepõem verticalmente", () => {
    const els = cardLayoutFromStyle("standard").sort((a, b) => a.y - b.y);
    for (let i = 1; i < els.length; i++) {
      expect(els[i].y).toBeGreaterThanOrEqual(
        els[i - 1].y + els[i - 1].h - 0.01,
      );
    }
  });

  it("respeita a cor de texto do catálogo", () => {
    const els = cardLayoutFromStyle("standard", { textColor: "#ffffff" });
    expect(els.every((e) => e.color === "#ffffff")).toBe(true);
  });
});

describe("cardStyleLabel", () => {
  it("nomeia os templates conhecidos", () => {
    expect(cardStyleLabel("standard")).toBe("Padrão");
    expect(cardStyleLabel("compact")).toBe("Compacto");
    expect(cardStyleLabel("minimal")).toBe("Minimalista");
  });
});
