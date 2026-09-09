import type { CatalogPage } from "../types";

// Distribuição dos produtos do grid pelas páginas — FONTE ÚNICA.
//
// Antes esta lógica existia duplicada em `catalog-editor.tsx` (pageChunks) e em
// `lib/layout.ts` (distributePages), com um comentário pedindo para manter as
// duas em sincronia. Agora as duas chamam daqui.
//
// A capacidade entra por callback porque o editor e o `layout.ts` calculam
// "itens por página" de formas próprias (o editor conhece a config viva; o
// layout serve o render público). O que precisa ser idêntico é a DISTRIBUIÇÃO,
// não o cálculo de capacidade.

/**
 * Modo EXPLÍCITO: ao menos uma página fixou `productIds`.
 *
 * Implementação por ÍNDICE, em uma passada. A versão anterior filtrava a lista
 * inteira de produtos uma vez por página — O(páginas × produtos), que num
 * catálogo de 474 páginas × 5.686 produtos dava ~2,7 M de operações a cada
 * recálculo. Aqui é O(produtos + ids).
 *
 * Três detalhes que precisam ser preservados ao pé da letra:
 *
 * 1. A ordem dentro de cada página é a ordem GLOBAL dos produtos (que já vem
 *    ordenada por `sortBy`/`productOrder`) — por isso a varredura é sobre
 *    `gridProducts`, não sobre `productIds`.
 * 2. A última página recolhe os não atribuídos, mas DEPOIS dos seus próprios.
 * 3. O mesmo produto pode estar em MAIS DE UMA página: `duplicatePage` copia
 *    `productIds` no spread, e nesse caso ele aparece nas duas. Daí o valor do
 *    índice ser `number | number[]` em vez de só `number`.
 */
function distributeExplicit<T extends { id: string }>(
  pages: readonly CatalogPage[],
  gridProducts: readonly T[],
): T[][] {
  const owners = new Map<string, number | number[]>();
  for (let i = 0; i < pages.length; i++) {
    for (const id of pages[i].productIds ?? []) {
      const cur = owners.get(id);
      if (cur === undefined) owners.set(id, i);
      else if (typeof cur === "number") owners.set(id, [cur, i]);
      else cur.push(i);
    }
  }

  const buckets: T[][] = pages.map(() => []);
  const unclaimed: T[] = [];
  for (const product of gridProducts) {
    const owner = owners.get(product.id);
    if (owner === undefined) unclaimed.push(product);
    else if (typeof owner === "number") buckets[owner].push(product);
    else for (const i of owner) buckets[i].push(product);
  }

  const last = pages.length - 1;
  if (last >= 0 && unclaimed.length > 0) buckets[last].push(...unclaimed);
  return buckets;
}

/**
 * Modo AUTOMÁTICO: sem `productIds` em nenhuma página. Sequencial por
 * capacidade; a última recebe todo o restante.
 */
function distributeAuto<T extends { id: string }>(
  pages: readonly CatalogPage[],
  gridProducts: readonly T[],
  capacityOf: (page: CatalogPage, index: number) => number,
): T[][] {
  const chunks: T[][] = [];
  let idx = 0;
  pages.forEach((pg, i) => {
    const per = capacityOf(pg, i);
    const isLast = i === pages.length - 1;
    chunks.push(
      isLast ? gridProducts.slice(idx) : gridProducts.slice(idx, idx + per),
    );
    idx += per;
  });
  return chunks;
}

/**
 * Página que não participa da distribuição — hoje só o índice.
 *
 * Não basta dar `productIds: []` a ela: no modo explícito a ÚLTIMA página
 * recolhe todos os produtos não atribuídos (ver `distributeExplicit`), e no
 * automático a última recebe todo o restante. Índice no fim do catálogo
 * receberia o resíduo do encarte inteiro.
 */
function isSpecialPage(page: CatalogPage): boolean {
  return page.kind === "index";
}

function distribute<T extends { id: string }>(
  pages: readonly CatalogPage[],
  gridProducts: readonly T[],
  capacityOf: (page: CatalogPage, index: number) => number,
): T[][] {
  const anyExplicit = pages.some((pg) => pg.productIds !== undefined);
  return anyExplicit
    ? distributeExplicit(pages, gridProducts)
    : distributeAuto(pages, gridProducts, capacityOf);
}

export function distributeProducts<T extends { id: string }>(
  pages: readonly CatalogPage[],
  gridProducts: readonly T[],
  capacityOf: (page: CatalogPage, index: number) => number,
): T[][] {
  if (!pages.some(isSpecialPage))
    return distribute(pages, gridProducts, capacityOf);

  // Distribui só entre as páginas comuns e devolve balde vazio nas especiais.
  // `capacityOf` recebe o índice ORIGINAL: os chamadores usam esse número para
  // achar a config da página, e o índice da lista filtrada apontaria para
  // outra.
  const comuns: CatalogPage[] = [];
  const posicoes: number[] = [];
  pages.forEach((pg, i) => {
    if (isSpecialPage(pg)) return;
    comuns.push(pg);
    posicoes.push(i);
  });

  const parciais = distribute(comuns, gridProducts, (pg, i) =>
    capacityOf(pg, posicoes[i]),
  );

  const buckets: T[][] = pages.map(() => []);
  posicoes.forEach((original, i) => {
    buckets[original] = parciais[i] ?? [];
  });
  return buckets;
}
