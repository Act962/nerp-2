import { describe, expect, it } from "vitest";
import {
  groupIdByProduct,
  nextCopyName,
  removeFromOtherGroups,
  sliceProductsByGroup,
  withProductAdopted,
} from "./group-slices";
import type { ProductGroup } from "../types";

// A referência abaixo é a lógica que rodava DENTRO do render
// (`catalog-preview.tsx`), copiada ao pé da letra. A suíte exige que a função
// compartilhada produza exatamente a mesma distribuição — é o que garante que a
// lateral e o canvas passem a concordar sem o canvas mudar de comportamento.

type P = { id: string };

function legacySlice(groups: ProductGroup[], products: P[]): P[][] {
  const namedIds = new Set(groups.flatMap((g) => g.productIds ?? []));
  const ungrouped = products.filter((p) => !namedIds.has(p.id));
  let capIdx = 0;
  return groups.map((g, gi) => {
    const cols = Math.max(1, g.gridCols);
    const cap = cols * Math.max(1, g.gridRows);
    const isLast = gi === groups.length - 1;
    let slice: P[];
    if (g.productIds && g.productIds.length > 0) {
      const set = new Set(g.productIds);
      slice = products.filter((p) => set.has(p.id));
      if (isLast) slice = [...slice, ...ungrouped];
    } else {
      slice = isLast
        ? ungrouped.slice(capIdx)
        : ungrouped.slice(capIdx, capIdx + cap);
      capIdx += cap;
    }
    return slice;
  });
}

function group(over: Partial<ProductGroup> = {}): ProductGroup {
  return {
    id: over.id ?? "g",
    rect: { x: 0, y: 0, w: 100, h: 100 },
    gridCols: 2,
    gridRows: 2,
    ...over,
  } as ProductGroup;
}

const prods = (n: number): P[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p-${i + 1}` }));

const ids = (out: P[][]) => out.map((s) => s.map((p) => p.id));

function expectSame(groups: ProductGroup[], products: P[]) {
  const novo = sliceProductsByGroup(groups, products);
  expect(ids(novo)).toEqual(ids(legacySlice(groups, products)));
  return novo;
}

describe("sliceProductsByGroup — equivalência com a regra do render", () => {
  it("grupos nomeados mostram os seus produtos", () => {
    const g = [
      group({ id: "a", productIds: ["p-1", "p-3"] }),
      group({ id: "b", productIds: ["p-2"] }),
    ];
    const out = expectSame(g, prods(3));
    expect(ids(out)).toEqual([["p-1", "p-3"], ["p-2"]]);
  });

  it("produto novo (sem grupo) cai no ÚLTIMO grupo", () => {
    const g = [
      group({ id: "a", productIds: ["p-1"] }),
      group({ id: "b", productIds: ["p-2"] }),
    ];
    const out = expectSame(g, prods(4));
    // p-3 e p-4 acabaram de ser adicionados: aparecem no último grupo.
    expect(ids(out)).toEqual([["p-1"], ["p-2", "p-3", "p-4"]]);
  });

  it("grupo único nomeado: tudo cai nele, inclusive o não atribuído", () => {
    const g = [group({ id: "a", productIds: ["p-1"] })];
    const out = expectSame(g, prods(3));
    expect(ids(out)).toEqual([["p-1", "p-2", "p-3"]]);
  });

  it("grupos de capacidade repartem sequencialmente", () => {
    const g = [group({ id: "a" }), group({ id: "b" })]; // 2×2 = 4 cada
    const out = expectSame(g, prods(10));
    expect(ids(out)[0]).toHaveLength(4);
    expect(ids(out)[1]).toHaveLength(6); // último recolhe a sobra
  });

  it("misto: um grupo nomeado + um de capacidade", () => {
    const g = [group({ id: "a", productIds: ["p-5"] }), group({ id: "b" })];
    expectSame(g, prods(6));
  });

  it("produto sai do Grupo 1 ao entrar no Grupo 2", () => {
    const antes = [
      group({ id: "a", productIds: ["p-1", "p-2"] }),
      group({ id: "b", productIds: [] }),
    ];
    expect(ids(sliceProductsByGroup(antes, prods(2)))[0]).toEqual([
      "p-1",
      "p-2",
    ]);
    const depois = [
      group({ id: "a", productIds: ["p-1"] }),
      group({ id: "b", productIds: ["p-2"] }),
    ];
    const out = sliceProductsByGroup(depois, prods(2));
    expect(ids(out)).toEqual([["p-1"], ["p-2"]]);
  });

  it("nenhum grupo", () => {
    expect(sliceProductsByGroup([], prods(3))).toEqual([]);
  });

  it("nenhum produto", () => {
    expectSame([group({ id: "a" }), group({ id: "b" })], []);
  });
});

describe("groupIdByProduct", () => {
  it("mapeia cada produto ao grupo que o exibe, inclusive o recém-adicionado", () => {
    const g = [
      group({ id: "a", productIds: ["p-1"] }),
      group({ id: "b", productIds: ["p-2"] }),
    ];
    const map = groupIdByProduct(g, prods(3));
    expect(map.get("p-1")).toBe("a");
    expect(map.get("p-2")).toBe("b");
    expect(map.get("p-3")).toBe("b"); // sem grupo → último
  });
});

describe("adoção de produto novo", () => {
  it("o último grupo nomeado adota — mesmo grupo que o canvas já exibia", () => {
    const g = [
      group({ id: "a", productIds: ["p-1"] }),
      group({ id: "b", productIds: ["p-2"] }),
    ];
    const out = withProductAdopted(g, "p-3");
    expect(out?.[0].productIds).toEqual(["p-1"]);
    expect(out?.[1].productIds).toEqual(["p-2", "p-3"]);
    // O desenho não muda: antes da adoção o p-3 já caía no grupo "b".
    expect(ids(sliceProductsByGroup(g, prods(3)))).toEqual(
      ids(sliceProductsByGroup(out ?? g, prods(3))),
    );
  });

  it("grupo de CAPACIDADE não adota (viraria nomeado sem pedir)", () => {
    const g = [group({ id: "a", productIds: ["p-1"] }), group({ id: "b" })];
    expect(withProductAdopted(g, "p-2")).toBeNull();
  });

  it("página sem grupos: nada a fazer", () => {
    expect(withProductAdopted([], "p-1")).toBeNull();
  });

  it("produto já no grupo não duplica", () => {
    const g = [group({ id: "a", productIds: ["p-1"] })];
    expect(withProductAdopted(g, "p-1")).toBeNull();
  });
});

describe("nextCopyName", () => {
  it('duplica "Hortifruti" como "Hortifruti (2)"', () => {
    const g = [group({ id: "a", name: "Hortifruti" })];
    expect(nextCopyName(g, "Hortifruti")).toBe("Hortifruti (2)");
  });

  it("pula números já usados", () => {
    const g = [
      group({ id: "a", name: "Hortifruti" }),
      group({ id: "b", name: "Hortifruti (2)" }),
    ];
    expect(nextCopyName(g, "Hortifruti")).toBe("Hortifruti (3)");
  });

  it("duplicar uma cópia não empilha sufixos", () => {
    const g = [
      group({ id: "a", name: "Hortifruti" }),
      group({ id: "b", name: "Hortifruti (2)" }),
    ];
    // A partir de "Hortifruti (2)" o próximo é "(3)", não "Hortifruti (2) (2)".
    expect(nextCopyName(g, "Hortifruti (2)")).toBe("Hortifruti (3)");
  });
});

describe("removeFromOtherGroups", () => {
  it("a maçã sai do Grupo Geral ao entrar no Hortifruti", () => {
    const g = [
      group({
        id: "geral",
        name: "Grupo Geral",
        productIds: ["maca", "acucar", "balde"],
      }),
      group({ id: "horti", name: "Hortifruti", productIds: ["maca"] }),
    ];
    const out = removeFromOtherGroups(g, ["maca"], "horti");
    expect(out[0].productIds).toEqual(["acucar", "balde"]);
    expect(out[1].productIds).toEqual(["maca"]);
    // E o canvas passa a mostrar cada uma no seu lugar, sem repetir.
    const slices = ids(
      sliceProductsByGroup(out, [
        { id: "maca" },
        { id: "acucar" },
        { id: "balde" },
      ]),
    );
    expect(slices).toEqual([["acucar", "balde"], ["maca"]]);
  });

  it("grupo de capacidade não é tocado", () => {
    const g = [group({ id: "cap" }), group({ id: "x", productIds: ["p-1"] })];
    expect(
      removeFromOtherGroups(g, ["p-1"], "x")[0].productIds,
    ).toBeUndefined();
  });
});
