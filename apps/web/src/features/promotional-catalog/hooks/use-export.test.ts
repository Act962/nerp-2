import { describe, expect, it } from "vitest";
import {
  EXPORT_PRESETS,
  type ExportQuality,
  formatMB,
  pixelRatioFor,
  presetDpi,
} from "./use-export";

const TODAS = Object.keys(EXPORT_PRESETS) as ExportQuality[];
// Largura de layout de uma página do catálogo (PAGE_W em catalog-preview).
const pagina = { offsetWidth: 1080, clientWidth: 1080 };

describe("pixelRatioFor", () => {
  // A REGRESSÃO que este arquivo existe para travar: havia um piso
  // `MIN_PIXEL_RATIO = 2`, e `max(2, 1620/1080)` é 2 — então "Equilibrada"
  // saía com o mesmo tamanho de "Alta" e escolher o preset não mudava nada.
  it("entrega a largura do preset, sem piso achatando os menores", () => {
    for (const q of TODAS) {
      const largura = pagina.offsetWidth * pixelRatioFor(pagina, q);
      expect(Math.round(largura), q).toBe(EXPORT_PRESETS[q].targetWidth);
    }
  });

  it("cada preset tem uma largura distinta", () => {
    const larguras = TODAS.map((q) => EXPORT_PRESETS[q].targetWidth);
    expect(new Set(larguras).size).toBe(larguras.length);
  });

  it("nó pequeno na tela ainda sai na largura alvo", () => {
    // O preview aparece reduzido (~572 px); a captura não pode herdar isso.
    const preview = { offsetWidth: 572, clientWidth: 572 };
    expect(Math.round(572 * pixelRatioFor(preview, "high"))).toBe(2160);
  });

  it("teto de 4× protege a memória do canvas", () => {
    const minusculo = { offsetWidth: 100, clientWidth: 100 };
    expect(pixelRatioFor(minusculo, "max")).toBe(4);
  });

  it("nó sem medida cai em 1080, não em zero", () => {
    const semLayout = { offsetWidth: 0, clientWidth: 0 };
    expect(Math.round(1080 * pixelRatioFor(semLayout, "high"))).toBe(2160);
  });
});

describe("presetDpi", () => {
  it("traduz a largura capturada em DPI da página impressa", () => {
    // 1080 px de layout = 285,75 mm = 11,25 pol.
    expect(presetDpi("max")).toBe(213);
    expect(presetDpi("high")).toBe(192);
    expect(presetDpi("balanced")).toBe(144);
    expect(presetDpi("light")).toBe(115);
  });
});

describe("presets", () => {
  it("o piso de qualidade nunca passa do nominal", () => {
    for (const q of TODAS) {
      const p = EXPORT_PRESETS[q];
      expect(p.minQuality, q).toBeLessThanOrEqual(p.quality);
      expect(p.minQuality, q).toBeGreaterThan(0.5);
      expect(p.quality, q).toBeLessThanOrEqual(1);
    }
  });
});

describe("formatMB", () => {
  it("mostra uma casa decimal", () => {
    expect(formatMB(46 * 1024 * 1024)).toBe("46.0 MB");
    expect(formatMB(1_500_000)).toBe("1.4 MB");
  });
});
