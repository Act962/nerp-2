import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const findMany = vi.fn();
vi.mock("@/lib/db", () => ({ default: { product: { findMany } } }));
vi.mock("@/features/precos/server/resolve-price", () => ({
  resolveManyPrices: vi.fn(async () => []),
}));

const { construirToolsDaLoja, palavrasDaBusca } = await import("./tools");

const contexto = {
  organizationId: "org-1",
  mostraPrecos: false,
  mostraProdutoSemEstoque: false,
  aceitaPedidos: true,
};

function produto(name: string) {
  return {
    id: name,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    currentStock: 5,
    category: { name: "CESTA BASICA" },
  };
}

type Busca = (input: { termo: string; categoria?: string }) => Promise<{
  quantidade: number;
  produtos: { nome: string }[];
}>;

function buscar(): Busca {
  const ferramenta = construirToolsDaLoja(contexto)
    .buscarProdutos as unknown as {
    execute: (input: unknown, options: unknown) => ReturnType<Busca>;
  };
  return (input) =>
    ferramenta.execute(input, { toolCallId: "t1", messages: [] });
}

describe("palavrasDaBusca", () => {
  it("separa a frase do cliente nas palavras do produto", () => {
    expect(palavrasDaBusca("Quero 2 leite em pó Camponesa 1kg")).toEqual([
      "leite",
      "pó",
      "camponesa",
      "1kg",
    ]);
  });

  it("ignora palavras vazias com e sem acento e números soltos", () => {
    // "têm" sem acento é "tem", que está na lista de palavras vazias.
    expect(palavrasDaBusca("vocês têm 10 unidades de açúcar?")).toEqual([
      "açúcar",
    ]);
  });

  it("não repete palavra", () => {
    expect(palavrasDaBusca("arroz arroz ARROZ")).toEqual(["arroz"]);
  });
});

describe("buscarProdutos", () => {
  beforeEach(() => findMany.mockReset());

  it("procura palavra a palavra, aceitando a forma sem acento", async () => {
    findMany.mockResolvedValueOnce([
      produto("LEITE EM PO CAMPONESA INSTANTANEO 1KG UN"),
    ]);
    const resultado = await buscar()({ termo: "leite em pó Camponesa 1kg" });

    expect(resultado.quantidade).toBe(1);
    const where = findMany.mock.calls[0]?.[0].where;
    expect(where.organizationId).toBe("org-1");
    expect(where.currentStock).toEqual({ gte: 1 });
    expect(where.AND).toContainEqual({
      OR: [
        { name: { contains: "pó", mode: "insensitive" } },
        { name: { contains: "po", mode: "insensitive" } },
      ],
    });
  });

  it("sem produto com todas as palavras, devolve os que têm mais delas", async () => {
    findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        produto("LEITE LIQUIDO ITAMBE 1L"),
        produto("LEITE EM PO CAMPONESA INSTANTANEO 1KG UN"),
      ]);
    const resultado = await buscar()({ termo: "leite em pó camponesa 2kg" });

    expect(findMany).toHaveBeenCalledTimes(2);
    expect(resultado.produtos[0]?.nome).toBe(
      "LEITE EM PO CAMPONESA INSTANTANEO 1KG UN",
    );
  });

  it("frase só com palavras vazias não filtra por nome", async () => {
    findMany.mockResolvedValueOnce([]);
    await buscar()({ termo: "quero" });
    expect(findMany.mock.calls[0]?.[0].where.AND).toBeUndefined();
  });
});
