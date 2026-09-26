import { describe, expect, it } from "vitest";
import { kitchenOrderLabel } from "./kitchen-order-label";

describe("kitchenOrderLabel", () => {
  it("mostra a mesa para pedido do salão", () => {
    expect(kitchenOrderLabel({ tableNumber: "18", saleNumber: null })).toBe(
      "Mesa 18",
    );
  });

  it("mostra o número da venda para pedido do catálogo", () => {
    expect(
      kitchenOrderLabel({ tableNumber: "Pedido #42", saleNumber: 42 }),
    ).toBe("Catálogo #42");
  });
});
