import { describe, expect, it } from "vitest";
import {
  buildCatalogIndex,
  indexPagesNeeded,
  type IndexSourcePage,
  sliceIndexRows,
} from "./catalog-index";

const prod = (name: string, categoryName?: string | null) => ({
  id: name,
  name,
  categoryName,
});

const CATALOGO: IndexSourcePage[] = [
  { name: "Capa", products: [] },
  {
    name: "RMC COMÉRCIO",
    products: [prod("Café Santa Clara 250G", "Cafés"), prod("Refresco", "Pó")],
  },
  {
    name: "F S COMERCIAL",
    products: [
      prod("Café Santa Clara 250G", "Cafés"),
      prod("Capsula", "Cafés"),
    ],
  },
];

describe("buildCatalogIndex — modo produto", () => {
  it("junta o mesmo produto numa linha com todas as páginas", () => {
    const rows = buildCatalogIndex(CATALOGO, "product");
    expect(
      rows.find((r) => r.label === "Café Santa Clara 250G")?.pages,
    ).toEqual([2, 3]);
    expect(rows.find((r) => r.label === "Capsula")?.pages).toEqual([3]);
  });

  it("ordena alfabeticamente em pt-BR", () => {
    expect(buildCatalogIndex(CATALOGO, "product").map((r) => r.label)).toEqual([
      "Café Santa Clara 250G",
      "Capsula",
      "Refresco",
    ]);
  });

  it("acento diferente não vira duas linhas", () => {
    const rows = buildCatalogIndex(
      [
        { name: "A", products: [prod("CAFÉ SANTA CLARA")] },
        { name: "B", products: [prod("Cafe Santa Clara")] },
      ],
      "product",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].pages).toEqual([1, 2]);
  });
});

describe("buildCatalogIndex — modo página", () => {
  it("mantém a ordem do documento, não a alfabética", () => {
    expect(buildCatalogIndex(CATALOGO, "page")).toEqual([
      { label: "Capa", pages: [1] },
      { label: "RMC COMÉRCIO", pages: [2] },
      { label: "F S COMERCIAL", pages: [3] },
    ]);
  });

  it("nome genérico vira o número da própria página", () => {
    const rows = buildCatalogIndex(
      [{ name: "Página 1", products: [] }, { products: [] }],
      "page",
    );
    expect(rows.map((r) => r.label)).toEqual(["Página 1", "Página 2"]);
  });
});

describe("buildCatalogIndex — modo categoria", () => {
  it("agrupa por categoria e reúne as páginas", () => {
    const rows = buildCatalogIndex(CATALOGO, "category");
    expect(rows.find((r) => r.label === "Cafés")?.pages).toEqual([2, 3]);
    expect(rows.find((r) => r.label === "Pó")?.pages).toEqual([2]);
  });

  it("produto sem categoria cai num balde nomeado", () => {
    const rows = buildCatalogIndex(
      [{ name: "A", products: [prod("X", null)] }],
      "category",
    );
    expect(rows[0].label).toBe("Sem categoria");
  });
});

describe("a própria página de índice", () => {
  // Ela não tem produtos e não é destino de nada — mas CONTA na numeração,
  // porque o leitor conta as páginas que vê.
  const comIndice: IndexSourcePage[] = [
    { name: "Capa", products: [] },
    { name: "Índice", kind: "index", products: [] },
    { name: "RMC", products: [prod("Café")] },
  ];

  it("não vira linha do índice", () => {
    expect(buildCatalogIndex(comIndice, "page").map((r) => r.label)).toEqual([
      "Capa",
      "RMC",
    ]);
  });

  it("desloca a numeração das páginas seguintes", () => {
    expect(buildCatalogIndex(comIndice, "product")[0].pages).toEqual([3]);
  });
});

describe("sliceIndexRows", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    label: `L${i}`,
    pages: [i + 1],
  }));

  it("reparte as linhas entre as páginas de índice", () => {
    expect(sliceIndexRows(rows, 0, 3, 4).map((r) => r.label)).toEqual([
      "L0",
      "L1",
      "L2",
      "L3",
    ]);
    expect(sliceIndexRows(rows, 1, 3, 4).map((r) => r.label)).toEqual([
      "L4",
      "L5",
      "L6",
      "L7",
    ]);
  });

  it("a última leva o resto — nenhuma linha some por falta de página", () => {
    expect(sliceIndexRows(rows, 1, 2, 4).map((r) => r.label)).toEqual([
      "L4",
      "L5",
      "L6",
      "L7",
      "L8",
      "L9",
    ]);
  });

  it("página de índice além do necessário fica vazia", () => {
    expect(sliceIndexRows(rows, 4, 5, 4)).toEqual([]);
  });
});

describe("indexPagesNeeded", () => {
  it("arredonda para cima e nunca devolve zero", () => {
    expect(indexPagesNeeded(10, 4)).toBe(3);
    expect(indexPagesNeeded(8, 4)).toBe(2);
    expect(indexPagesNeeded(0, 4)).toBe(1);
  });
});
