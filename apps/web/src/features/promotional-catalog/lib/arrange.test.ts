import { describe, expect, it } from "vitest";
import { alignBoxes, distributeBoxes, type Box } from "./arrange";

const PAGE = { w: 1080, h: 1080 };
const b = (id: string, x: number, y: number, w = 100, h = 50): Box => ({
  id,
  x,
  y,
  w,
  h,
});

describe("alignBoxes", () => {
  it("com UMA caixa, a referência é a página", () => {
    const [r] = alignBoxes([b("a", 10, 10, 200, 100)], "center-h", PAGE);
    expect(r.x).toBe(440); // (0 + 1080) / 2 - 200/2
  });

  it("centraliza uma caixa na vertical da página", () => {
    const [r] = alignBoxes([b("a", 10, 10, 200, 100)], "center-v", PAGE);
    expect(r.y).toBe(490);
  });

  it("com VÁRIAS, a referência é a seleção — não a página", () => {
    const out = alignBoxes([b("a", 100, 0), b("b", 300, 0)], "left", PAGE);
    // Alinha na borda esquerda da seleção (100), não na da página (0).
    expect(out.map((x) => x.x)).toEqual([100, 100]);
  });

  it("alinha à direita pela borda da seleção", () => {
    const out = alignBoxes(
      [b("a", 100, 0, 100), b("b", 300, 0, 50)],
      "right",
      PAGE,
    );
    // Borda direita da seleção = 300 + 50 = 350.
    expect(out.map((x) => x.x)).toEqual([250, 300]);
  });

  it("centro horizontal respeita larguras diferentes", () => {
    const out = alignBoxes(
      [b("a", 0, 0, 100), b("b", 200, 0, 200)],
      "center-h",
      PAGE,
    );
    // Seleção vai de 0 a 400 → centro 200.
    expect(out.map((x) => x.x)).toEqual([150, 100]);
  });

  it("topo e base usam as bordas verticais da seleção", () => {
    const sel = [b("a", 0, 40, 100, 50), b("b", 0, 200, 100, 80)];
    expect(alignBoxes(sel, "top", PAGE).map((x) => x.y)).toEqual([40, 40]);
    // Base da seleção = 200 + 80 = 280.
    expect(alignBoxes(sel, "bottom", PAGE).map((x) => x.y)).toEqual([230, 200]);
  });

  it("lista vazia não quebra", () => {
    expect(alignBoxes([], "left", PAGE)).toEqual([]);
  });
});

describe("distributeBoxes", () => {
  it("menos de 3 caixas não tem o que distribuir", () => {
    const sel = [b("a", 0, 0), b("b", 500, 0)];
    expect(distributeBoxes(sel, "h")).toEqual(sel);
  });

  it("iguala os VÃOS, não os centros", () => {
    // a: 0..100, c: 400..500. Sobra 300 de vão para 2 intervalos = 150 cada.
    const out = distributeBoxes(
      [b("a", 0, 0, 100), b("m", 150, 0, 50), b("c", 400, 0, 100)],
      "h",
    );
    const byId = new Map(out.map((x) => [x.id, x]));
    // vão livre = (400 - 100 - 50) / 2 = 125
    expect(byId.get("m")?.x).toBe(225);
    // As das pontas não se movem.
    expect(byId.get("a")?.x).toBe(0);
    expect(byId.get("c")?.x).toBe(400);
  });

  it("com tamanhos iguais, os vãos ficam idênticos", () => {
    const out = distributeBoxes(
      [b("a", 0, 0, 100), b("m", 120, 0, 100), b("c", 400, 0, 100)],
      "h",
    );
    const xs = out.map((x) => x.x).sort((p, q) => p - q);
    const vao1 = xs[1] - (xs[0] + 100);
    const vao2 = xs[2] - (xs[1] + 100);
    expect(vao1).toBe(vao2);
  });

  it("funciona no eixo vertical", () => {
    const out = distributeBoxes(
      [b("a", 0, 0, 100, 50), b("m", 0, 60, 100, 50), b("c", 0, 400, 100, 50)],
      "v",
    );
    const byId = new Map(out.map((x) => [x.id, x]));
    // vão = (400 - 50 - 50) / 2 = 150 → m em 50 + 150 = 200
    expect(byId.get("m")?.y).toBe(200);
  });

  it("ordem de entrada embaralhada não afeta o resultado", () => {
    const sel = [b("c", 400, 0, 100), b("a", 0, 0, 100), b("m", 150, 0, 50)];
    const out = distributeBoxes(sel, "h");
    expect(out.find((x) => x.id === "m")?.x).toBe(225);
    // Devolve na MESMA ordem em que entrou.
    expect(out.map((x) => x.id)).toEqual(["c", "a", "m"]);
  });
});
