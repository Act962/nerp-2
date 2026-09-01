import { describe, expect, it } from "vitest";
import { buildPurchaseEntries } from "./purchase-entries";

const receivedAt = new Date("2026-03-10T12:00:00.000Z");

const base = {
  purchaseNumber: 12,
  invoiceNumber: "45678",
  total: 100,
  installments: 1,
  firstDueDate: null,
  receivedAt,
};

describe("buildPurchaseEntries", () => {
  it("à vista gera uma parcela só, sem marcação de parcelamento", () => {
    const [entry, ...rest] = buildPurchaseEntries(base);

    expect(rest).toHaveLength(0);
    expect(entry.purchaseEntryKey).toBe("parcela-0");
    expect(entry.amount).toBe(10_000);
    expect(entry.description).toBe("Compra #12 — NF 45678");
    expect(entry.installmentTotal).toBeNull();
    expect(entry.installmentCurrent).toBeNull();
  });

  it("fecha o total exato jogando o resto na última parcela", () => {
    const entries = buildPurchaseEntries({ ...base, installments: 3 });

    expect(entries.map((e) => e.amount)).toEqual([3333, 3333, 3334]);
    expect(entries.reduce((sum, e) => sum + e.amount, 0)).toBe(10_000);
  });

  it("numera as parcelas na descrição e nos campos do Financeiro", () => {
    const entries = buildPurchaseEntries({ ...base, installments: 3 });

    expect(entries[1].description).toBe("Compra #12 — NF 45678 (2/3)");
    expect(entries[1].installmentTotal).toBe(3);
    expect(entries[1].installmentCurrent).toBe(2);
  });

  it("vence de mês em mês a partir da primeira data informada", () => {
    const entries = buildPurchaseEntries({
      ...base,
      installments: 3,
      firstDueDate: new Date("2026-04-05T12:00:00.000Z"),
    });

    expect(entries.map((e) => e.dueDate.toISOString().slice(0, 10))).toEqual([
      "2026-04-05",
      "2026-05-05",
      "2026-06-05",
    ]);
  });

  it("sem data informada, a primeira vence no recebimento", () => {
    const [entry] = buildPurchaseEntries(base);
    expect(entry.dueDate).toEqual(receivedAt);
  });

  it("não transborda o mês quando o vencimento cai no dia 31", () => {
    const entries = buildPurchaseEntries({
      ...base,
      installments: 2,
      firstDueDate: new Date("2026-01-31T12:00:00.000Z"),
    });

    // Fevereiro não tem 31: a parcela fecha no último dia, não escorrega
    // para março.
    expect(entries[1].dueDate.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("competência é sempre o recebimento, não o vencimento", () => {
    const entries = buildPurchaseEntries({
      ...base,
      installments: 2,
      firstDueDate: new Date("2026-08-05T12:00:00.000Z"),
    });

    expect(entries.every((e) => e.competenceDate === receivedAt)).toBe(true);
  });

  it("nota sem fornecedor identificado sai sem o trecho da NF", () => {
    const [entry] = buildPurchaseEntries({ ...base, invoiceNumber: null });
    expect(entry.description).toBe("Compra #12");
  });

  it("total zerado não vira conta a pagar", () => {
    expect(buildPurchaseEntries({ ...base, total: 0 })).toEqual([]);
  });
});
