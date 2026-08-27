import type { CatalogPage } from "../types";

// Aplicação de produtos por CATEGORIA — lógica pura (sem React, sem prisma).
//
// Regra central: **1 página = 1 categoria**. Os grupos são processados em
// sequência, cada um começando onde o anterior parou, para que o nome e o
// vínculo dinâmico da página sempre correspondam ao que está nela.

export type CategoryGroup = {
  // null = balde "Sem categoria" (não há entidade para vincular).
  id: string | null;
  name: string;
  ids: string[];
};

export type ApplyParams = {
  pages: readonly CatalogPage[];
  // Página em que o dev está — a única candidata a ser completada, e o molde
  // de layout/fundo das páginas novas.
  currentIndex: number;
  groups: readonly CategoryGroup[];
  // `pageChunks[i].map(p => p.id)` — a distribuição que está na tela agora.
  // Serve para congelar as páginas que ainda não fixaram `productIds`.
  frozenProductIds: readonly string[][];
  capacityOf: (page: CatalogPage) => number;
};

export type ApplyResult = {
  pages: CatalogPage[];
  addedIds: string[];
  // Índice da primeira página tocada — o editor salta para ela no fim.
  firstTouchedIndex: number;
};

/** Uma página pertence a este grupo? */
function belongsTo(page: CatalogPage, group: CategoryGroup): boolean {
  if (group.id === null) {
    // "Sem categoria" não tem vínculo dinâmico; a identidade é o nome.
    return !page.dynamic && page.name.startsWith(group.name);
  }
  return page.dynamic?.type === "category" && page.dynamic.refId === group.id;
}

/**
 * Ajusta a grade de uma página que recebeu MENOS itens que a capacidade, para
 * não ficar com buracos: mantém as colunas (mexer nelas alargaria os cards e a
 * página sairia com cards de tamanho diferente das outras), reduz as linhas e
 * centraliza a última fileira.
 *
 * Só vale para `layout: "custom"`, onde a capacidade é literalmente
 * colunas × linhas. Nos outros layouts a grade é fluida — menos itens já
 * ocupam menos espaço sozinhos — e mexer em `gridRows` não teria efeito.
 */
function fitGrid(page: CatalogPage, count: number): CatalogPage {
  if (page.layout !== "custom") return page;
  if (page.productGroups && page.productGroups.length > 0) return page;
  const cols = Math.max(1, page.gridCols);
  const rows = Math.max(1, Math.ceil(count / cols));
  // Duas decisões INDEPENDENTES: encolher as linhas só faz sentido se sobrarem
  // fileiras inteiras vazias; centralizar depende apenas de a última fileira
  // estar incompleta. Com 11 itens em 4 colunas as linhas não mudam (3 → 3),
  // mas os 3 órfãos da última fileira ainda precisam ser centralizados.
  const shrink = rows < page.gridRows;
  const orphans = count % cols !== 0;
  if (!shrink && !orphans) return page;
  return {
    ...page,
    ...(shrink ? { gridRows: rows } : {}),
    ...(orphans ? { centerLastRow: true } : {}),
  };
}

export function applyCategoryGroups({
  pages,
  currentIndex,
  groups,
  frozenProductIds,
  capacityOf,
}: ApplyParams): ApplyResult {
  // Congela a distribuição atual: cada página sem `productIds` fixa o que
  // mostra AGORA, para nenhum produto pular de página quando as novas entrarem.
  const out: CatalogPage[] = pages.map((pg, i) =>
    pg.productIds !== undefined
      ? { ...pg }
      : { ...pg, productIds: [...(frozenProductIds[i] ?? [])] },
  );

  const safeIndex = Math.min(Math.max(0, currentIndex), out.length - 1);
  const template = out[safeIndex];
  const perPage = Math.max(1, capacityOf(template));

  const addedIds: string[] = [];
  let insertAt = safeIndex + 1;
  let firstTouched = -1;
  let uid = 0;

  for (const [groupIndex, group] of groups.entries()) {
    let queue = group.ids;
    if (queue.length === 0) continue;

    // Numeração continua de onde a categoria parou numa aplicação anterior.
    let seq = out.filter((p) => belongsTo(p, group)).length;

    // Só o PRIMEIRO grupo pode completar a página atual: a partir do segundo,
    // cada categoria começa em página própria (senão duas se misturariam).
    if (groupIndex === 0) {
      const cur = out[safeIndex];
      const curIds = cur.productIds ?? [];
      const isEmptyAndFree = curIds.length === 0 && !cur.dynamic;
      const eligible = !cur.locked && (belongsTo(cur, group) || isEmptyAndFree);
      const free = Math.max(0, capacityOf(cur) - curIds.length);

      if (eligible && free > 0) {
        const take = queue.slice(0, free);
        queue = queue.slice(free);
        addedIds.push(...take);
        const merged = [...curIds, ...take];
        // Página vazia que recebe a categoria vira a primeira dela: ganha nome
        // e vínculo, senão ficaria anônima entre "BEBIDAS 2", "BEBIDAS 3"…
        const claim = isEmptyAndFree;
        if (claim) seq += 1;
        out[safeIndex] = fitGrid(
          {
            ...cur,
            productIds: merged,
            ...(claim
              ? {
                  name: `${group.name} ${seq}`,
                  ...(group.id
                    ? {
                        dynamic: { type: "category" as const, refId: group.id },
                      }
                    : {}),
                }
              : {}),
          },
          merged.length,
        );
        firstTouched = safeIndex;
      }
    }

    // O que sobrou vira páginas novas, herdando o molde da página atual.
    while (queue.length > 0) {
      const slice = queue.slice(0, perPage);
      queue = queue.slice(perPage);
      addedIds.push(...slice);
      seq += 1;
      uid += 1;

      const novo: CatalogPage = fitGrid(
        {
          ...template,
          id: `page-cat-${insertAt}-${uid}`,
          name: `${group.name} ${seq}`,
          locked: false,
          // Herda do molde o layout, o fundo e os elementos DINÂMICOS — os
          // estáticos ficam. É a mesma regra de `toTemplateConfig` ("estáticos
          // ficam de fora: é conteúdo"), e é ela que faz o título da categoria
          // aparecer sozinho nas 50 páginas: cada uma nasce com o seu próprio
          // `dynamic`, então o mesmo texto resolve um nome diferente em cada.
          // Um texto estático repetido 40 vezes continua sendo lixo.
          //
          // Id novo por página: dois elementos de mesmo id em páginas
          // diferentes fazem a camada de seleção editar o errado — foi
          // exatamente o que aconteceu com os grupos em `duplicatePage`.
          // Derivado (não aleatório) para o módulo continuar puro e testável.
          overlays: (template.overlays ?? [])
            .filter((o) => o.binding)
            .map((o) => ({ ...o, id: `${o.id}-c${uid}` })),
          texts: (template.texts ?? [])
            .filter((t) => t.binding)
            .map((t) => ({ ...t, id: `${t.id}-c${uid}` })),
          // Bloco de estilo aponta para UM produto (`productId`): repetido nas
          // páginas novas mostraria o mesmo produto em todas elas.
          styleBlocks: [],
          productIds: slice,
          ...(group.id
            ? { dynamic: { type: "category" as const, refId: group.id } }
            : { dynamic: undefined }),
        },
        slice.length,
      );

      out.splice(insertAt, 0, novo);
      if (firstTouched === -1) firstTouched = insertAt;
      insertAt += 1;
    }
  }

  return {
    pages: out,
    addedIds,
    firstTouchedIndex: firstTouched === -1 ? safeIndex : firstTouched,
  };
}

/**
 * Quantas páginas uma aplicação vai gerar — para a prévia do diálogo.
 *
 * Recebe a CONTAGEM de cada categoria, não os ids: a prévia roda a cada render
 * e não precisa materializar milhares de strings só para dividir.
 *
 * O arredondamento é POR categoria porque 1 página = 1 categoria. Somar tudo e
 * dividir uma vez daria menos páginas do que a aplicação realmente cria.
 */
export function previewPageCount(
  counts: readonly number[],
  perPage: number,
): number {
  const per = Math.max(1, perPage);
  return counts.reduce((sum, n) => sum + Math.ceil(n / per), 0);
}
