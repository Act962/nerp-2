import { describe, expect, it } from "vitest";
import {
  orphanedByPageDelete,
  paginasComProduto,
  productIdsOnPage,
  removerDaPagina,
} from "./page-products";
import type { CatalogPage } from "../types";

function page(over: Partial<CatalogPage> = {}): CatalogPage {
  return {
    id: over.id ?? "p",
    name: over.name ?? "Página",
    locked: false,
    layout: "custom",
    gridCols: 4,
    gridRows: 3,
    overlays: [],
    ...over,
  } as CatalogPage;
}

describe("productIdsOnPage", () => {
  it("junta productIds, blocos de estilo e grupos", () => {
    const p = page({
      productIds: ["a"],
      styleBlocks: [{ id: "b1", productId: "b" }] as CatalogPage["styleBlocks"],
      productGroups: [
        {
          id: "g",
          rect: { x: 0, y: 0, w: 1, h: 1 },
          gridCols: 2,
          gridRows: 2,
          productIds: ["c"],
        },
      ] as CatalogPage["productGroups"],
    });
    expect(productIdsOnPage(p).sort()).toEqual(["a", "b", "c"]);
  });

  it("bloco de estilo sem produto não vira id vazio", () => {
    const p = page({
      productIds: ["a"],
      styleBlocks: [{ id: "b1" }] as CatalogPage["styleBlocks"],
    });
    expect(productIdsOnPage(p)).toEqual(["a"]);
  });
});

describe("orphanedByPageDelete", () => {
  it("página duplicada: apagar uma NÃO tira os produtos da outra", () => {
    // O caso relatado: três páginas cópia, todas com os mesmos productIds.
    const ids = ["p-1", "p-2", "p-3"];
    const pages = [
      page({ id: "a", productIds: [...ids] }),
      page({ id: "b", name: "Página (cópia)", productIds: [...ids] }),
      page({ id: "c", name: "Página (cópia) (cópia)", productIds: [...ids] }),
    ];
    expect(orphanedByPageDelete(pages, 1)).toEqual([]);
  });

  it("produto só da página apagada sai do catálogo", () => {
    const pages = [
      page({ id: "a", productIds: ["p-1"] }),
      page({ id: "b", productIds: ["p-2"] }),
    ];
    expect(orphanedByPageDelete(pages, 1)).toEqual(["p-2"]);
  });

  it("mistura: sai só o que não sobrou em outra página", () => {
    const pages = [
      page({ id: "a", productIds: ["p-1", "p-2"] }),
      page({ id: "b", productIds: ["p-2", "p-3"] }),
    ];
    // p-2 continua na página "a"; só o p-3 fica órfão.
    expect(orphanedByPageDelete(pages, 1)).toEqual(["p-3"]);
  });

  it("conta o produto preso num bloco de estilo de outra página", () => {
    const pages = [
      page({
        id: "a",
        styleBlocks: [
          { id: "b1", productId: "p-1" },
        ] as CatalogPage["styleBlocks"],
      }),
      page({ id: "b", productIds: ["p-1"] }),
    ];
    expect(orphanedByPageDelete(pages, 1)).toEqual([]);
  });

  it("conta o produto que vive num GRUPO de outra página", () => {
    const pages = [
      page({
        id: "a",
        productGroups: [
          {
            id: "g",
            rect: { x: 0, y: 0, w: 1, h: 1 },
            gridCols: 2,
            gridRows: 2,
            productIds: ["p-1"],
          },
        ] as CatalogPage["productGroups"],
      }),
      page({ id: "b", productIds: ["p-1", "p-9"] }),
    ];
    expect(orphanedByPageDelete(pages, 1)).toEqual(["p-9"]);
  });

  it("índice inexistente não quebra", () => {
    expect(orphanedByPageDelete([page({ id: "a" })], 7)).toEqual([]);
  });
});

describe("removerDaPagina", () => {
  it("produto em duas páginas: sai de uma e continua na outra", () => {
    const pages = [
      page({ productIds: ["a", "b"] }),
      page({ productIds: ["a"] }),
    ];
    const r = removerDaPagina(pages, 0, ["a"]);
    expect(r.pages[0].productIds).toEqual(["b"]);
    expect(r.pages[1].productIds).toEqual(["a"]);
    expect(r.orfaos).toEqual([]);
  });

  it("saindo da última página que o mostrava, vira órfão", () => {
    const pages = [
      page({ productIds: ["a", "b"] }),
      page({ productIds: ["c"] }),
    ];
    expect(removerDaPagina(pages, 0, ["a"]).orfaos).toEqual(["a"]);
  });

  it("tira também de bloco de estilo e de grupo com lista própria", () => {
    const pages = [
      page({
        productIds: [],
        styleBlocks: [
          { id: "s", productId: "a" },
        ] as CatalogPage["styleBlocks"],
        productGroups: [
          {
            id: "g",
            rect: { x: 0, y: 0, w: 1, h: 1 },
            gridCols: 2,
            gridRows: 2,
            productIds: ["a", "b"],
          },
        ] as CatalogPage["productGroups"],
      }),
    ];
    const r = removerDaPagina(pages, 0, ["a"]);
    expect(r.pages[0].styleBlocks).toEqual([]);
    expect(r.pages[0].productGroups?.[0].productIds).toEqual(["b"]);
    expect(r.orfaos).toEqual(["a"]);
  });

  it("grupo de fluxo (sem productIds) continua sem lista", () => {
    const pages = [
      page({
        productIds: ["a"],
        productGroups: [
          {
            id: "g",
            rect: { x: 0, y: 0, w: 1, h: 1 },
            gridCols: 2,
            gridRows: 2,
          },
        ] as CatalogPage["productGroups"],
      }),
    ];
    const r = removerDaPagina(pages, 0, ["a"]);
    expect(r.pages[0].productGroups?.[0].productIds).toBeUndefined();
  });

  it("apagar o grupo leva o grupo e os produtos dele", () => {
    const pages = [
      page({
        productGroups: [
          {
            id: "g",
            rect: { x: 0, y: 0, w: 1, h: 1 },
            gridCols: 2,
            gridRows: 2,
            productIds: ["a"],
          },
        ] as CatalogPage["productGroups"],
      }),
    ];
    const r = removerDaPagina(pages, 0, ["a"], "g");
    expect(r.pages[0].productGroups).toEqual([]);
    expect(r.orfaos).toEqual(["a"]);
  });

  it("paginasComProduto conta as páginas que o mostram", () => {
    const pages = [
      page({ productIds: ["a"] }),
      page({ productIds: ["a", "b"] }),
    ];
    expect(paginasComProduto(pages, "a")).toBe(2);
    expect(paginasComProduto(pages, "b")).toBe(1);
  });
});
