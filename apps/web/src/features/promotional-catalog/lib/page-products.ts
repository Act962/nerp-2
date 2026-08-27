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
