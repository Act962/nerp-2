import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../../../app/router/promotional-catalog/types";
import type { CatalogConfig, CatalogPage } from "../types";
import { indiceDoMolde, montarPorCategorias } from "./montar-por-categorias";

function page(over: Partial<CatalogPage> = {}): CatalogPage {
  return {
    id: over.id ?? "p",
    name: over.name ?? "Página",
    locked: false,
    layout: "custom",
    gridCols: 2,
    gridRows: 2,
    overlays: [],
    ...over,
  } as CatalogPage;
}

const capa = page({ id: "capa", name: "Capa" });
const produtos = page({
  id: "prod",
  name: "Página 1 (cópia)",
  productIds: ["x1", "x2"],
  texts: [
    { id: "t", text: "Arranjos Florais" } as CatalogPage["texts"] extends
      | (infer T)[]
      | undefined
      ? T
      : never,
  ],
});

const molde = {
  ...DEFAULT_CONFIG,
  pages: [capa, produtos],
  shareToken: "segredo",
  priceOverrides: { x1: 9 },
} as unknown as CatalogConfig;

const capacidade = () => 4;

describe("montarPorCategorias", () => {
  it("o molde é a primeira página com produtos", () => {
    expect(indiceDoMolde([capa, produtos])).toBe(1);
  });

  it("mantém a capa e cria uma página por categoria, 4 por página", () => {
    const { config } = montarPorCategorias({
      molde,
      capacidade,
      grupos: [
        { id: "c1", name: "Arranjos", ids: ["a1", "a2", "a3", "a4", "a5"] },
        { id: "c2", name: "Box", ids: ["b1"] },
      ],
    });
    const pages = config.pages ?? [];
    expect(pages[0].id).toBe("capa");
    expect(pages.map((p) => p.name)).toEqual([
      "Capa",
      "Arranjos 1",
      "Arranjos 2",
      "Box 1",
    ]);
    expect(pages[1].productIds).toEqual(["a1", "a2", "a3", "a4"]);
    expect(pages[1].dynamic).toEqual({ type: "category", refId: "c1" });
    expect(pages[3].productIds).toEqual(["b1"]);
  });

  it("não leva produtos, preços nem o link público do molde", () => {
    const { config } = montarPorCategorias({
      molde,
      capacidade,
      grupos: [{ id: "c1", name: "Arranjos", ids: ["a1"] }],
    });
    expect(config.manuallyAddedIds).toEqual(["a1"]);
    expect(config.priceOverrides).toEqual({});
    expect((config as { shareToken?: string }).shareToken).toBeUndefined();
    expect(
      (config.pages ?? []).flatMap((p) => p.productIds ?? []),
    ).not.toContain("x1");
  });

  it("avisa os textos fixos do molde", () => {
    const { textosFixosDoMolde } = montarPorCategorias({
      molde,
      capacidade,
      grupos: [{ id: "c1", name: "Arranjos", ids: ["a1"] }],
    });
    expect(textosFixosDoMolde).toEqual(["Arranjos Florais"]);
  });
});
