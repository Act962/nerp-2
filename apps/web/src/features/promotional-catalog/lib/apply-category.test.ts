import { describe, expect, it } from "vitest";
import { applyCategoryGroups, previewPageCount } from "./apply-category";
import type { CatalogPage } from "../types";

function page(over: Partial<CatalogPage> = {}): CatalogPage {
  return {
    id: over.id ?? "p1",
    name: over.name ?? "Página 1",
    locked: false,
    layout: "custom",
    gridCols: 4,
    gridRows: 3, // capacidade 12
    overlays: [],
    ...over,
  } as CatalogPage;
}

const cap = (pg: CatalogPage) =>
  pg.productGroups && pg.productGroups.length > 0
    ? pg.productGroups.reduce((s, g) => s + g.gridCols * g.gridRows, 0)
    : pg.gridCols * pg.gridRows;

const ids = (n: number, prefix = "p") =>
  Array.from({ length: n }, (_, i) => `${prefix}-${i + 1}`);

const run = (
  pages: CatalogPage[],
  groups: { id: string | null; name: string; ids: string[] }[],
  currentIndex = 0,
  frozen: string[][] = [],
) =>
  applyCategoryGroups({
    pages,
    currentIndex,
    groups,
    frozenProductIds: frozen,
    capacityOf: cap,
  });

const BEBIDAS = (n: number) => ({
  id: "cat-beb",
  name: "BEBIDAS",
  ids: ids(n, "beb"),
});

describe("applyCategoryGroups", () => {
  it("preenche a página atual quando ela está vazia, sem criar página nova", () => {
    const r = run([page()], [BEBIDAS(12)]);
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0].productIds).toHaveLength(12);
    expect(r.addedIds).toHaveLength(12);
    // Página vazia adotada pela categoria ganha nome e vínculo.
    expect(r.pages[0].name).toBe("BEBIDAS 1");
    expect(r.pages[0].dynamic).toEqual({ type: "category", refId: "cat-beb" });
  });

  it("120 produtos numa grade de 12 viram 10 páginas", () => {
    const r = run([page()], [BEBIDAS(120)]);
    expect(r.pages).toHaveLength(10);
    expect(r.pages.map((p) => p.productIds?.length)).toEqual(
      Array(10).fill(12),
    );
    expect(r.pages.map((p) => p.name)).toEqual(
      Array.from({ length: 10 }, (_, i) => `BEBIDAS ${i + 1}`),
    );
  });

  it("categoria com 3 produtos: encolhe a grade em vez de deixar buraco", () => {
    const r = run([page()], [{ id: "c", name: "TEMPEROS", ids: ids(3) }]);
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0].gridRows).toBe(1); // ceil(3/4)
    expect(r.pages[0].gridCols).toBe(4); // colunas intactas
    expect(r.pages[0].centerLastRow).toBe(true);
  });

  it("23 produtos: 1 página cheia + 1 página encolhida de 11", () => {
    const r = run([page()], [{ id: "c", name: "X", ids: ids(23) }]);
    expect(r.pages.map((p) => p.productIds?.length)).toEqual([12, 11]);
    expect(r.pages[0].gridRows).toBe(3); // cheia, não encolhe
    expect(r.pages[1].gridRows).toBe(3); // ceil(11/4) = 3
    expect(r.pages[1].centerLastRow).toBe(true); // 11 % 4 !== 0
  });

  it("NÃO completa a página atual quando ela é de outra categoria", () => {
    const atual = page({
      id: "a",
      name: "MERCEARIA 1",
      productIds: ["m-1"],
      dynamic: { type: "category", refId: "cat-merc" },
    });
    const r = run([atual], [BEBIDAS(4)]);
    expect(r.pages).toHaveLength(2);
    expect(r.pages[0].productIds).toEqual(["m-1"]); // intacta
    expect(r.pages[1].name).toBe("BEBIDAS 1");
  });

  it("completa a página atual quando ela JÁ é da mesma categoria", () => {
    const atual = page({
      id: "a",
      name: "BEBIDAS 1",
      productIds: ["beb-0"],
      dynamic: { type: "category", refId: "cat-beb" },
    });
    const r = run([atual], [BEBIDAS(5)]);
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0].productIds).toHaveLength(6); // 1 + 5
  });

  it("página bloqueada é pulada", () => {
    const atual = page({ id: "a", locked: true });
    const r = run([atual], [BEBIDAS(3)]);
    expect(r.pages).toHaveLength(2);
    expect(r.pages[0].productIds).toEqual([]);
    expect(r.pages[1].productIds).toHaveLength(3);
  });

  it("congela as páginas que ainda não fixaram productIds", () => {
    const a = page({ id: "a" });
    const b = page({ id: "b", name: "Página 2" });
    const r = run([a, b], [BEBIDAS(6)], 1, [["x-1", "x-2"], ["x-3"]]);
    expect(r.pages[0].productIds).toEqual(["x-1", "x-2"]);
    // A página 2 tinha 1 produto congelado e recebeu 6 — mas não estava vazia,
    // então não foi adotada pela categoria; virou página nova.
    expect(r.pages[1].productIds).toEqual(["x-3"]);
    expect(r.pages[2].productIds).toHaveLength(6);
  });

  it("várias categorias: cada uma em páginas próprias, nenhuma mistura", () => {
    const r = run(
      [page()],
      [
        { id: "c1", name: "BEBIDAS", ids: ids(14, "b") },
        { id: "c2", name: "MERCEARIA", ids: ids(3, "m") },
      ],
    );
    expect(r.pages.map((p) => p.name)).toEqual([
      "BEBIDAS 1",
      "BEBIDAS 2",
      "MERCEARIA 1",
    ]);
    // Nenhuma página tem produtos de duas categorias.
    expect(r.pages[1].productIds).toEqual(["b-13", "b-14"]);
    expect(r.pages[2].productIds).toEqual(["m-1", "m-2", "m-3"]);
  });

  it('grupo "Sem categoria" não recebe vínculo dinâmico', () => {
    const r = run([page()], [{ id: null, name: "Sem categoria", ids: ids(3) }]);
    expect(r.pages[0].name).toBe("Sem categoria 1");
    expect(r.pages[0].dynamic).toBeUndefined();
  });

  it("aplicar de novo na mesma categoria continua a numeração", () => {
    const primeira = run([page()], [BEBIDAS(24)]);
    expect(primeira.pages.map((p) => p.name)).toEqual([
      "BEBIDAS 1",
      "BEBIDAS 2",
    ]);
    const segunda = applyCategoryGroups({
      pages: primeira.pages,
      currentIndex: 1,
      groups: [{ id: "cat-beb", name: "BEBIDAS", ids: ids(12, "beb2") }],
      frozenProductIds: [],
      capacityOf: cap,
    });
    expect(segunda.pages.map((p) => p.name)).toEqual([
      "BEBIDAS 1",
      "BEBIDAS 2",
      "BEBIDAS 3",
    ]);
  });

  it("página multi-grupo: capacidade soma os grupos e a grade não encolhe", () => {
    const atual = page({
      id: "a",
      productGroups: [
        {
          id: "g1",
          rect: { x: 0, y: 0, w: 100, h: 100 },
          gridCols: 3,
          gridRows: 2,
        },
        {
          id: "g2",
          rect: { x: 0, y: 0, w: 100, h: 100 },
          gridCols: 2,
          gridRows: 2,
        },
      ],
    } as Partial<CatalogPage>);
    const r = run([atual], [{ id: "c", name: "X", ids: ids(10) }]);
    // 3×2 + 2×2 = 10 — cabe tudo na página atual.
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0].productIds).toHaveLength(10);
    expect(r.pages[0].gridRows).toBe(3); // intacta
  });

  it("páginas novas não herdam etiquetas/textos da página-molde", () => {
    const atual = page({
      id: "a",
      productIds: ["ja-1"],
      name: "Capa",
      overlays: [{ id: "o1" }] as CatalogPage["overlays"],
      texts: [{ id: "t1" }] as CatalogPage["texts"],
    });
    const r = run([atual], [BEBIDAS(4)]);
    expect(r.pages[0].overlays).toHaveLength(1); // a capa fica intacta
    expect(r.pages[1].overlays).toEqual([]);
    expect(r.pages[1].texts).toEqual([]);
  });

  it("aponta a primeira página tocada, para o editor saltar até ela", () => {
    const a = page({ id: "a", productIds: ["x"], name: "Capa" });
    const r = run([a], [BEBIDAS(4)]);
    expect(r.firstTouchedIndex).toBe(1);
  });

  it("grupo vazio é ignorado", () => {
    const r = run([page()], [{ id: "c", name: "VAZIA", ids: [] }]);
    expect(r.pages).toHaveLength(1);
    expect(r.addedIds).toEqual([]);
  });
});

describe("previewPageCount", () => {
  it("conta por categoria, arredondando para cima em cada uma", () => {
    // 14 → 2 páginas, 3 → 1 página. Somando os produtos daria 17 → 2, errado.
    expect(previewPageCount([14, 3], 12)).toBe(3);
  });

  it("5.686 produtos numa categoria só, 12 por página", () => {
    expect(previewPageCount([5686], 12)).toBe(474);
  });
});
