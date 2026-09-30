import type { CatalogPage } from "../types";

// Quais produtos uma página referencia, e quais ficam órfãos ao apagá-la.
//
// Um produto pode estar em MAIS DE UMA página: `duplicatePage` copia o
// `productIds` no spread, então uma página duplicada aponta para os mesmos
// produtos da original. Apagar uma delas não pode tirar o produto do catálogo
// enquanto a outra ainda o mostra.

/** Todos os ids de produto que a página referencia, por qualquer caminho. */
export function productIdsOnPage(page: CatalogPage): string[] {
  return [
    ...(page.productIds ?? []),
    // Bloco de estilo consome um produto fora do grid — conta como referência.
    ...(page.styleBlocks ?? [])
      .map((b) => b.productId)
      .filter((id): id is string => !!id),
    // Grupos nomeados guardam os seus próprios ids.
    ...(page.productGroups ?? []).flatMap((g) => g.productIds ?? []),
  ];
}

/**
 * Produtos que saem do catálogo ao apagar a página `index`: os que ela
 * referencia e que NENHUMA página restante referencia.
 *
 * Sem este filtro, apagar uma página duplicada levava junto os produtos das
 * outras cópias — elas ficavam vazias sem o usuário ter pedido.
 */
export function orphanedByPageDelete(
  pages: readonly CatalogPage[],
  index: number,
): string[] {
  const alvo = pages[index];
  if (!alvo) return [];
  const sobreviventes = new Set(
    pages.flatMap((pg, i) => (i === index ? [] : productIdsOnPage(pg))),
  );
  return [...new Set(productIdsOnPage(alvo))].filter(
    (id) => !sobreviventes.has(id),
  );
}

/** Em quantas páginas o produto aparece. */
export function paginasComProduto(
  pages: readonly CatalogPage[],
  productId: string,
): number {
  return pages.filter((pg) => productIdsOnPage(pg).includes(productId)).length;
}

export type RemocaoDaPagina = {
  pages: CatalogPage[];
  /** Os que saíram da última página que os mostrava — saem do catálogo. */
  orfaos: string[];
};

/**
 * Tira produtos de UMA página: da grade, dos blocos de estilo e dos grupos.
 *
 * Quem chama passa as páginas com a distribuição já congelada
 * (`congelarDistribuicao`), senão a página sem `productIds` explícitos
 * redistribuiria e o produto reapareceria nela. `grupo` apaga também o grupo
 * nomeado. Só vira órfão — e deve sair do catálogo — o que nenhuma outra
 * página ainda mostra: remover de uma cópia não pode esvaziar a original.
 */
export function removerDaPagina(
  pages: readonly CatalogPage[],
  indice: number,
  ids: readonly string[],
  grupo?: string,
): RemocaoDaPagina {
  const alvo = new Set(ids);
  const proximas = pages.map((pg, i) => {
    if (i !== indice) return pg;
    return {
      ...pg,
      productIds: (pg.productIds ?? []).filter((id) => !alvo.has(id)),
      styleBlocks: (pg.styleBlocks ?? []).filter(
        (b) => !b.productId || !alvo.has(b.productId),
      ),
      productGroups: (pg.productGroups ?? [])
        .filter((g) => g.id !== grupo)
        // Grupo sem `productIds` é região de fluxo: gravar `[]` nele mudaria o
        // comportamento dele, então só os grupos com lista própria são filtrados.
        .map((g) =>
          g.productIds
            ? { ...g, productIds: g.productIds.filter((id) => !alvo.has(id)) }
            : g,
        ),
    };
  });
  const aindaVisiveis = new Set(proximas.flatMap(productIdsOnPage));
  return {
    pages: proximas,
    orfaos: [...alvo].filter((id) => !aindaVisiveis.has(id)),
  };
}
