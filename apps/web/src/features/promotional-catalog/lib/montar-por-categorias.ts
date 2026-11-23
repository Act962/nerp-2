import { type CatalogConfig, type CatalogPage, ensurePages } from "../types";
import { applyCategoryGroups, type CategoryGroup } from "./apply-category";
import { productIdsOnPage } from "./page-products";

// "Criar por categorias" num passo — lógica pura (sem React, sem prisma).
//
// Parte de um catálogo existente como MOLDE: fica a capa (páginas vazias antes
// da primeira página de produtos) e a página de produtos vira o molde das
// páginas por categoria, pela mesma `applyCategoryGroups` do editor. É o que o
// dev fazia à mão em ~40 passos: duplicar, esvaziar o molde, aplicar.

export type MontagemPorCategorias = {
  config: CatalogConfig;
  /** Textos fixos do molde: ficam só na 1ª página gerada — vale avisar. */
  textosFixosDoMolde: string[];
};

/** A página de produtos que serve de molde: a primeira com produtos. */
export function indiceDoMolde(pages: readonly CatalogPage[]): number {
  const comProdutos = pages.findIndex(
    (pg) => pg.kind !== "index" && productIdsOnPage(pg).length > 0,
  );
  if (comProdutos >= 0) return comProdutos;
  // Sem produto em lugar nenhum: a última página não-índice faz o papel.
  for (let i = pages.length - 1; i >= 0; i--) {
    if (pages[i].kind !== "index") return i;
  }
  return 0;
}

export function montarPorCategorias({
  molde,
  grupos,
  capacidade,
}: {
  molde: CatalogConfig;
  grupos: readonly CategoryGroup[];
  capacidade: (pagina: CatalogPage, config: CatalogConfig) => number;
}): MontagemPorCategorias {
  const paginas = ensurePages(molde);
  const iMolde = indiceDoMolde(paginas);

  // Capa = páginas antes do molde que não mostram produto.
  const capas = paginas
    .slice(0, iMolde)
    .filter((pg) => pg.kind !== "index" && productIdsOnPage(pg).length === 0);

  const base = paginas[iMolde];
  // Molde vazio, SEM vínculo e com nome padrão: assim a primeira categoria o
  // "reivindica" (ganha nome e vínculo) em vez de ele sobrar em branco.
  const moldeVazio: CatalogPage = {
    ...base,
    name: "Página",
    dynamic: undefined,
    productIds: [],
    styleBlocks: [],
    productGroups: (base.productGroups ?? []).map((g) =>
      g.productIds ? { ...g, productIds: [] } : g,
    ),
  };

  const iniciais = [...capas, moldeVazio];
  const resultado = applyCategoryGroups({
    pages: iniciais,
    currentIndex: capas.length,
    groups: grupos,
    frozenProductIds: iniciais.map(() => []),
    capacityOf: (pg) => capacidade(pg, molde),
  });

  const {
    shareToken: _semLinkPublico,
    list: _semLista,
    ...estilo
  } = molde as CatalogConfig & { shareToken?: string };

  return {
    config: {
      ...estilo,
      pages: resultado.pages,
      manuallyAddedIds: resultado.addedIds,
      excludedProductIds: [],
      categoryFilter: [],
      autoPromotions: false,
      productOrder: undefined,
      priceOverrides: {},
      offerOverrides: {},
      imageAdjustments: {},
      imageOverrides: {},
    },
    textosFixosDoMolde: (base.texts ?? [])
      .filter((t) => !t.binding && t.text.trim())
      .map((t) => t.text.trim()),
  };
}
