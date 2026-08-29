import { describe, expect, it } from "vitest";
import {
  CART_TTL_MS,
  type PdvCartItem,
  recoverableItems,
} from "./pdv-cart-store";

const AGORA = 1_700_000_000_000;

const item: PdvCartItem = {
  id: "1",
  productId: "p1",
  name: "Arroz 5kg",
  currentStock: 10,
  sku: "AR-5",
  unit: "UN",
  price: 25,
  quantity: 2,
};

describe("recoverableItems", () => {
  it("devolve o carrinho salvo há pouco", () => {
    expect(
      recoverableItems({ items: [item], savedAt: AGORA - 1000 }, AGORA),
    ).toEqual([item]);
  });

  // Carrinho velho é carrinho abandonado: ressuscitar criaria venda com preço
  // desatualizado sem ninguém perceber.
  it("descarta carrinho fora da janela", () => {
    const velho = AGORA - CART_TTL_MS - 1;
    expect(recoverableItems({ items: [item], savedAt: velho }, AGORA)).toEqual(
      [],
    );
  });

  it("aceita exatamente no limite da janela", () => {
    const limite = AGORA - CART_TTL_MS;
    expect(
      recoverableItems({ items: [item], savedAt: limite }, AGORA),
    ).toHaveLength(1);
  });

  it("nada a recuperar quando não há itens ou não há carimbo", () => {
    expect(recoverableItems({ items: [], savedAt: AGORA }, AGORA)).toEqual([]);
    expect(recoverableItems({ items: [item], savedAt: null }, AGORA)).toEqual(
      [],
    );
  });
});
