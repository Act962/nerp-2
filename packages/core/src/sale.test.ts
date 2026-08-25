import { describe, expect, it } from "vitest";
import { canTransitionSale, isFullyPaid, type Tender } from "./sale";

describe("SaleState", () => {
  it("permite transições válidas do fluxo de checkout", () => {
    expect(canTransitionSale("draft", "awaiting_payment")).toBe(true);
    expect(canTransitionSale("awaiting_payment", "paid")).toBe(true);
    expect(canTransitionSale("paid", "enqueued")).toBe(true);
  });

  it("barra transições ilegais", () => {
    expect(canTransitionSale("enqueued", "draft")).toBe(false);
    expect(canTransitionSale("cancelled", "paid")).toBe(false);
    expect(canTransitionSale("draft", "paid")).toBe(false);
  });
});

describe("isFullyPaid", () => {
  const t = (amount: number, approved: boolean): Tender => ({
    amount,
    approved,
  });

  it("cobre com dinheiro + processor aprovados (pagamento misto)", () => {
    expect(isFullyPaid(100, [t(50, true), t(50, true)])).toBe(true);
  });

  it("não cobre quando falta um tender aprovar", () => {
    expect(isFullyPaid(100, [t(50, true), t(50, false)])).toBe(false);
  });

  it("respeita a tolerância de centavo", () => {
    expect(isFullyPaid(100, [t(99.995, true)])).toBe(true);
    expect(isFullyPaid(100, [t(99.9, true)])).toBe(false);
  });
});
