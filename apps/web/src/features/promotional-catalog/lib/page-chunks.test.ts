import { describe, expect, it } from "vitest";
import { distributeProducts } from "./page-chunks";
import type { CatalogPage } from "../types";

// Teste de EQUIVALÊNCIA. `legacyDistribute` abaixo é a implementação que rodava
// em `catalog-editor.tsx` (pageChunks) e em `lib/layout.ts` (distributePages)
// antes da otimização por índice — copiada aqui ao pé da letra, de propósito.
//
// A regra desta suíte: qualquer cenário deve produzir saída IDÊNTICA nas duas.
// É o que garante que trocar o cálculo não mexeu em "adicionar produtos
// normalmente", que é o fluxo que o dev usa todo dia.

type P = { id: string };

function legacyDistribute(
  pages: CatalogPage[],
  gridProducts: P[],
  capacityOf: (page: CatalogPage, index: number) => number,
): P[][] {
  const anyExplicit = pages.some((pg) => pg.productIds !== undefined);
  if (anyExplicit) {
    const claimed = new Set<string>();
    for (const pg of pages)
      for (const id of pg.productIds ?? []) claimed.add(id);
    return pages.map((pg, i) => {
      const idSet = new Set(pg.productIds ?? []);
      let arr = gridProducts.filter((p) => idSet.has(p.id));
      if (i === pages.length - 1)
        arr = [...arr, ...gridProducts.filter((p) => !claimed.has(p.id))];
      return arr;
    });
  }
  const chunks: P[][] = [];
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

const prods = (n: number): P[] =>
  Array.from({ length: n }, (_, i) => ({ id: `prod-${i + 1}` }));

const ids = (list: P[][]) => list.map((page) => page.map((p) => p.id));

// Capacidade fixa de 12 (4 × 3) — o layout que o dev usa.
const cap12 = () => 12;

function expectSame(
  pages: CatalogPage[],
  products: P[],
  capacityOf: (page: CatalogPage, index: number) => number = cap12,
) {
  const novo = distributeProducts(pages, products, capacityOf);
  const antigo = legacyDistribute(pages, products, capacityOf);
  expect(ids(novo)).toEqual(ids(antigo));
  return novo;
}

describe("distributeProducts — equivalência com a implementação anterior", () => {
  it("modo automático: sequencial por capacidade, última recolhe o resto", () => {
    const pages = [page({ id: "a" }), page({ id: "b" }), page({ id: "c" })];
    const out = expectSame(pages, prods(30));
    expect(out[0]).toHaveLength(12);
    expect(out[1]).toHaveLength(12);
    expect(out[2]).toHaveLength(6);
  });

  it("modo automático com uma página só: recebe tudo", () => {
    const out = expectSame([page({ id: "a" })], prods(50));
    expect(out[0]).toHaveLength(50);
  });

  it("modo automático com menos produtos que a capacidade", () => {
    const out = expectSame([page({ id: "a" }), page({ id: "b" })], prods(3));
    expect(ids(out)).toEqual([["prod-1", "prod-2", "prod-3"], []]);
  });

  it("modo explícito: cada página mostra os seus, na ordem global", () => {
    const pages = [
      page({ id: "a", productIds: ["prod-3", "prod-1"] }),
      page({ id: "b", productIds: ["prod-2"] }),
    ];
    // A ordem dentro da página segue a lista global, NÃO a ordem de productIds.
    const out = expectSame(pages, prods(3));
    expect(ids(out)).toEqual([["prod-1", "prod-3"], ["prod-2"]]);
  });

  it("modo explícito: a última página recolhe os órfãos DEPOIS dos seus", () => {
    const pages = [
      page({ id: "a", productIds: ["prod-1"] }),
      page({ id: "b", productIds: ["prod-2"] }),
    ];
    const out = expectSame(pages, prods(5));
    expect(ids(out)).toEqual([
      ["prod-1"],
      ["prod-2", "prod-3", "prod-4", "prod-5"],
    ]);
  });

  it("modo explícito com página vazia (productIds: [])", () => {
    const pages = [
      page({ id: "a", productIds: [] }),
      page({ id: "b", productIds: ["prod-1", "prod-2"] }),
    ];
    expectSame(pages, prods(2));
  });

  it("modo MISTO: página sem productIds no meio de páginas com", () => {
    const pages = [
      page({ id: "a", productIds: ["prod-1"] }),
      page({ id: "b" }),
      page({ id: "c", productIds: ["prod-2"] }),
    ];
    expectSame(pages, prods(4));
  });

  it("produto duplicado em duas páginas (duplicatePage copia productIds)", () => {
    const pages = [
      page({ id: "a", productIds: ["prod-1", "prod-2"] }),
      page({ id: "b", productIds: ["prod-1", "prod-2"] }),
    ];
    const out = expectSame(pages, prods(3));
    // Aparece nas DUAS — é o comportamento atual de uma página duplicada.
    expect(ids(out)).toEqual([
      ["prod-1", "prod-2"],
      ["prod-1", "prod-2", "prod-3"],
    ]);
  });

  it("productIds apontando para produto inexistente (excluído do catálogo)", () => {
    const pages = [
      page({ id: "a", productIds: ["prod-1", "sumiu"] }),
      page({ id: "b", productIds: ["prod-2"] }),
    ];
    expectSame(pages, prods(2));
  });

  it("nenhum produto", () => {
    expectSame([page({ id: "a", productIds: [] }), page({ id: "b" })], []);
  });

  it("capacidade variável por página (multi-grupo soma as grades)", () => {
    const pages = [page({ id: "a" }), page({ id: "b" }), page({ id: "c" })];
    const capacity = (_pg: CatalogPage, i: number) => [5, 10, 3][i] ?? 1;
    const out = expectSame(pages, prods(40), capacity);
    expect(out[0]).toHaveLength(5);
    expect(out[1]).toHaveLength(10);
    expect(out[2]).toHaveLength(25); // última recolhe o resto
  });

  it("escala: 474 páginas × 5.686 produtos batem com a implementação antiga", () => {
    const total = 5686;
    const perPage = 12;
    const products = prods(total);
    const pages: CatalogPage[] = [];
    for (let i = 0; i < Math.ceil(total / perPage); i++) {
      pages.push(
        page({
          id: `p-${i}`,
          productIds: products
            .slice(i * perPage, (i + 1) * perPage)
            .map((p) => p.id),
        }),
      );
    }
    expect(pages).toHaveLength(474);
    expectSame(pages, products);
  });
});
