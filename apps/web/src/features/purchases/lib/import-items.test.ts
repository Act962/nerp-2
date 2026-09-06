import { describe, expect, it } from "vitest";
import type { PickedProduct } from "../components/item-search";
import { autoMapear, paraNumero, resolverLinhas } from "./import-items";

const arroz: PickedProduct = {
  id: "p1",
  name: "Arroz 5kg",
  sku: "ARR5",
  barcode: "7891000000001",
  unit: "UN",
  costPrice: 20,
  salePrice: 28,
  currentStock: 10,
  trackStock: true,
};

const catalogo = new Map<string, PickedProduct>([
  ["7891000000001", arroz],
  ["ARR5", arroz],
]);

const MAPA = {
  codigo: "Código",
  quantidade: "Qtd",
  custo: "Custo",
  desconto: "Desconto",
  precoVenda: "Venda",
};

describe("paraNumero", () => {
  it("lê decimal com vírgula tratando ponto como milhar", () => {
    expect(paraNumero("1.234,56")).toBe(1234.56);
    expect(paraNumero("12,50")).toBe(12.5);
  });

  it("lê decimal com ponto quando não há vírgula", () => {
    expect(paraNumero("1234.56")).toBe(1234.56);
  });

  it("ignora símbolo de moeda e espaços", () => {
    expect(paraNumero(" R$ 12,50 ")).toBe(12.5);
  });

  it("devolve null para vazio e para texto sem número", () => {
    expect(paraNumero("")).toBeNull();
    expect(paraNumero("   ")).toBeNull();
    expect(paraNumero(null)).toBeNull();
  });
});

describe("autoMapear", () => {
  it("casa por apelido, ignorando acento e caixa", () => {
    expect(
      autoMapear(["Código de Barras", "QTDE", "Preço de Custo", "sobra"]),
    ).toEqual({
      codigo: "Código de Barras",
      quantidade: "QTDE",
      custo: "Preço de Custo",
    });
  });

  it("não inventa coluna quando nada bate", () => {
    expect(autoMapear(["coluna a", "coluna b"])).toEqual({});
  });
});

describe("resolverLinhas", () => {
  it("não devolve nada enquanto as colunas obrigatórias não estão mapeadas", () => {
    const { prontos, ignorados } = resolverLinhas(
      [{ Código: "7891000000001", Qtd: "2" }],
      { codigo: "Código" },
      catalogo,
    );
    expect(prontos).toEqual([]);
    expect(ignorados).toEqual([]);
  });

  it("resolve por código de barras e por SKU", () => {
    const { prontos } = resolverLinhas(
      [
        { Código: "7891000000001", Qtd: "2" },
        { Código: "ARR5", Qtd: "1" },
      ],
      MAPA,
      catalogo,
    );
    expect(prontos.map((linha) => linha.product.id)).toEqual(["p1", "p1"]);
  });

  it("numera as linhas como o Excel mostra, contando o cabeçalho", () => {
    const { ignorados } = resolverLinhas(
      [
        { Código: "", Qtd: "1" },
        { Código: "999", Qtd: "1" },
      ],
      MAPA,
      catalogo,
    );
    expect(ignorados).toEqual([
      { numero: 2, motivo: "sem código" },
      { numero: 3, motivo: "código 999 não cadastrado" },
    ]);
  });

  it("ignora quantidade ausente, zerada ou negativa", () => {
    const { prontos, ignorados } = resolverLinhas(
      [
        { Código: "ARR5", Qtd: "0" },
        { Código: "ARR5", Qtd: "-3" },
        { Código: "ARR5", Qtd: "" },
      ],
      MAPA,
      catalogo,
    );
    expect(prontos).toEqual([]);
    expect(ignorados.map((linha) => linha.motivo)).toEqual([
      "quantidade inválida",
      "quantidade inválida",
      "quantidade inválida",
    ]);
  });

  it("cai no custo atual do produto quando a planilha não traz custo", () => {
    const { prontos } = resolverLinhas(
      [{ Código: "ARR5", Qtd: "1", Custo: "" }],
      MAPA,
      catalogo,
    );
    expect(prontos[0].unitPrice).toBe(20);
  });

  it("aceita custo zero — bonificação não é campo vazio", () => {
    const { prontos } = resolverLinhas(
      [{ Código: "ARR5", Qtd: "1", Custo: "0" }],
      MAPA,
      catalogo,
    );
    expect(prontos[0].unitPrice).toBe(0);
  });

  it("trata preço de venda zerado como ausente, para não zerar a venda", () => {
    const { prontos } = resolverLinhas(
      [{ Código: "ARR5", Qtd: "1", Venda: "0" }],
      MAPA,
      catalogo,
    );
    expect(prontos[0].newSalePrice).toBeNull();
  });

  it("lê custo, desconto e venda em formato pt-BR", () => {
    const { prontos } = resolverLinhas(
      [
        {
          Código: "ARR5",
          Qtd: "3",
          Custo: "1.234,56",
          Desconto: "10,50",
          Venda: "1.999,90",
        },
      ],
      MAPA,
      catalogo,
    );
    expect(prontos[0]).toMatchObject({
      quantity: 3,
      unitPrice: 1234.56,
      discount: 10.5,
      newSalePrice: 1999.9,
    });
  });
});
