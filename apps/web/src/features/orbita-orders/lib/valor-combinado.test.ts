import { describe, expect, it } from "vitest";
import {
  ValorCombinadoInvalido,
  distribuirValorCombinado,
} from "./valor-combinado";

const itens = [
  { id: "a", productId: "p1", quantity: 2 },
  { id: "b", productId: "p2", quantity: 1 },
];

describe("distribuirValorCombinado", () => {
  it("usa o preço de cada item quando o Órbita manda item a item", () => {
    const r = distribuirValorCombinado(itens, {
      items: [
        { productId: "p1", unitPrice: 10 },
        { productId: "p2", unitPrice: 5.5 },
      ],
    });
    expect(r.total).toBe(25.5);
    expect(r.itens).toEqual([
      { id: "a", unitPrice: 10, total: 20 },
      { id: "b", unitPrice: 5.5, total: 5.5 },
    ]);
  });

  it("rateia só o total pela quantidade e fecha no centavo", () => {
    const r = distribuirValorCombinado(itens, { total: 100 });
    const soma = r.itens.reduce((acc, item) => acc + item.total, 0);
    expect(r.total).toBe(100);
    expect(Math.round(soma * 100)).toBe(10000);
    expect(r.itens[0].total).toBe(66.66);
    expect(r.itens[1].total).toBe(33.34);
  });

  it("recusa quando falta o preço de um item", () => {
    expect(() =>
      distribuirValorCombinado(itens, {
        items: [{ productId: "p1", unitPrice: 10 }],
      }),
    ).toThrow(ValorCombinadoInvalido);
  });

  it("recusa total que não bate com os itens", () => {
    expect(() =>
      distribuirValorCombinado(itens, {
        total: 30,
        items: [
          { productId: "p1", unitPrice: 10 },
          { productId: "p2", unitPrice: 5 },
        ],
      }),
    ).toThrow(ValorCombinadoInvalido);
  });

  it("recusa sem total e sem itens", () => {
    expect(() => distribuirValorCombinado(itens, {})).toThrow(
      ValorCombinadoInvalido,
    );
  });
});
