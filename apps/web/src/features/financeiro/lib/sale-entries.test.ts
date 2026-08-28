import { describe, expect, it } from "vitest";
import { buildSaleEntries, settlementFor, toCents } from "./sale-entries";

const VENDA = new Date("2026-08-28T14:00:00.000Z");

function build(over: Partial<Parameters<typeof buildSaleEntries>[0]> = {}) {
  return buildSaleEntries({
    saleNumber: 42,
    saleDate: VENDA,
    payments: [{ method: "DINHEIRO", amount: 100 }],
    total: 100,
    cmv: 60,
    ...over,
  });
}

describe("settlementFor", () => {
  it("dinheiro, PIX e débito já entraram: nascem pagos na data da venda", () => {
    for (const metodo of ["DINHEIRO", "PIX", "DEBITO"] as const) {
      const s = settlementFor(metodo, VENDA);
      expect(s.status).toBe("PAID");
      expect(s.paidAt).toEqual(VENDA);
      expect(s.dueDate).toEqual(VENDA);
    }
  });

  // Crédito só vira dinheiro no repasse da adquirente.
  it("crédito nasce pendente com vencimento no repasse", () => {
    const s = settlementFor("CREDITO", VENDA);

    expect(s.status).toBe("PENDING");
    expect(s.paidAt).toBeNull();
    expect(s.dueDate.getTime() - VENDA.getTime()).toBe(
      30 * 24 * 60 * 60 * 1000,
    );
  });

  it("boleto e transferência ficam pendentes sem inventar prazo", () => {
    for (const metodo of ["BOLETO", "TRANSFERENCIA", "OUTROS"] as const) {
      const s = settlementFor(metodo, VENDA);
      expect(s.status).toBe("PENDING");
      expect(s.dueDate).toEqual(VENDA);
    }
  });
});

describe("buildSaleEntries", () => {
  it("gera uma linha por forma de pagamento mais o custo", () => {
    const entries = build({
      payments: [
        { method: "DINHEIRO", amount: 40 },
        { method: "CREDITO", amount: 60 },
      ],
      total: 100,
    });

    expect(entries.map((e) => e.saleEntryKey)).toEqual([
      "pag-0",
      "pag-1",
      "cmv",
    ]);
  });

  // O que faz a venda aparecer no DRE do mês certo mesmo pagando no crédito.
  it("reconhece tudo na competência da venda, não na liquidação", () => {
    const entries = build({
      payments: [{ method: "CREDITO", amount: 100 }],
    });

    for (const entry of entries) expect(entry.competenceDate).toEqual(VENDA);
    expect(entries[0].dueDate).not.toEqual(VENDA);
  });

  it("guarda valores em centavos", () => {
    const [receita] = build({
      payments: [{ method: "DINHEIRO", amount: 19.9 }],
      total: 19.9,
      cmv: 0,
    });

    expect(receita.amount).toBe(1990);
    expect(receita.paidAmount).toBe(1990);
    expect(toCents(19.9)).toBe(1990);
  });

  // Converter cada forma isoladamente escaparia um centavo do total; no
  // financeiro isso vira divergência de conciliação.
  it("a soma das receitas bate exatamente com o total", () => {
    const entries = build({
      payments: [
        { method: "DINHEIRO", amount: 33.33 },
        { method: "PIX", amount: 33.33 },
        { method: "DEBITO", amount: 33.34 },
      ],
      total: 100,
      cmv: 0,
    });

    const soma = entries
      .filter((e) => e.type === "RECEIVABLE")
      .reduce((total, e) => total + e.amount, 0);
    expect(soma).toBe(10_000);
  });

  it("o custo entra como pago, para não virar dívida falsa a pagar", () => {
    const cmv = build().find((e) => e.saleEntryKey === "cmv");

    expect(cmv).toMatchObject({
      type: "PAYABLE",
      status: "PAID",
      amount: 6000,
      paidAmount: 6000,
      categoryKind: "COST",
    });
  });

  it("sem custo conhecido, não inventa linha de CMV", () => {
    expect(build({ cmv: 0 }).some((e) => e.saleEntryKey === "cmv")).toBe(false);
    expect(build({ cmv: -5 }).some((e) => e.saleEntryKey === "cmv")).toBe(
      false,
    );
  });

  it("descarta forma de pagamento zerada", () => {
    const entries = build({
      payments: [
        { method: "DINHEIRO", amount: 100 },
        { method: "PIX", amount: 0 },
      ],
      total: 100,
      cmv: 0,
    });

    expect(entries).toHaveLength(1);
  });

  it("pendente não conta como recebido", () => {
    const [entry] = build({
      payments: [{ method: "CREDITO", amount: 100 }],
      cmv: 0,
    });

    expect(entry.status).toBe("PENDING");
    expect(entry.paidAmount).toBe(0);
    expect(entry.paidAt).toBeNull();
  });
});
