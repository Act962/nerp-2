import { describe, expect, it } from "vitest";
import {
  canTransitionCashSession,
  type LocalCashMovement,
  summarizeCash,
} from "./cash-session";

describe("CashSessionState", () => {
  it("abre → fecha; fechado é terminal", () => {
    expect(canTransitionCashSession("open", "closed")).toBe(true);
    expect(canTransitionCashSession("closed", "open")).toBe(false);
    expect(canTransitionCashSession("open", "open")).toBe(false);
  });
});

describe("summarizeCash", () => {
  const mov = (
    kind: LocalCashMovement["kind"],
    amount: number,
    paymentMethod?: string,
  ): LocalCashMovement => ({
    kind,
    amount,
    paymentMethod,
    createdAt: "2026-01-01T00:00:00Z",
  });

  it("só DINHEIRO afeta a gaveta; cartão/PIX entram no total, não no esperado", () => {
    // Abertura 100; venda R$40 dinheiro + R$60 cartão (mista).
    const s = summarizeCash(100, [
      mov("VENDA", 40, "DINHEIRO"),
      mov("VENDA", 60, "CREDITO"),
    ]);
    expect(s.salesTotal).toBe(100);
    expect(s.salesCash).toBe(40);
    expect(s.expectedCash).toBe(140); // 100 + 40 (só o dinheiro)
  });

  it("suprimento soma e sangria subtrai da gaveta", () => {
    const s = summarizeCash(100, [
      mov("SUPRIMENTO", 50),
      mov("VENDA", 30, "DINHEIRO"),
      mov("SANGRIA", 20),
    ]);
    // 100 + 50 (suprimento) + 30 (venda dinheiro) − 20 (sangria) = 160
    expect(s.expectedCash).toBe(160);
    expect(s.suprimentos).toBe(50);
    expect(s.sangrias).toBe(20);
  });

  it("ABERTURA/FECHAMENTO não entram no cálculo (abertura vem do saldo)", () => {
    const s = summarizeCash(100, [
      mov("ABERTURA", 100),
      mov("FECHAMENTO", 130),
    ]);
    expect(s.expectedCash).toBe(100);
    expect(s.salesTotal).toBe(0);
  });
});
