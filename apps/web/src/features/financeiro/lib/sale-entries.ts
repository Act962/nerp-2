import type { PaymentMethod } from "@/generated/prisma/enums";

/**
 * Tradução de uma VENDA para lançamentos do Financeiro.
 *
 * Uma venda não vira um lançamento só: cada forma de pagamento liquida num
 * momento diferente (dinheiro entra na hora, crédito no repasse da adquirente)
 * e o custo da mercadoria é uma linha à parte. Fundir tudo obrigaria a escolher
 * um único status e uma única data — errados para pelo menos uma das partes.
 *
 * Módulo puro: sem Prisma, sem I/O. A gravação fica em `server/sale-entries.ts`.
 */

export type SaleEntryCategory = "REVENUE" | "COST";

export interface SaleEntryDraft {
  /** Discrimina a linha dentro da venda ("pag-0", "cmv"). Chave de idempotência. */
  saleEntryKey: string;
  type: "RECEIVABLE" | "PAYABLE";
  status: "PENDING" | "PAID";
  description: string;
  /** Em CENTAVOS — é como o Financeiro guarda dinheiro. */
  amount: number;
  paidAmount: number;
  dueDate: Date;
  paidAt: Date | null;
  /**
   * Data que o DRE usa para agrupar. É sempre a data da VENDA, nunca a da
   * liquidação: receita se reconhece quando a venda acontece, senão uma venda
   * no crédito sumiria do mês em que foi feita.
   */
  competenceDate: Date;
  categoryKind: SaleEntryCategory;
}

// Formas que liquidam no balcão: o dinheiro entra na hora.
const LIQUIDA_NA_HORA: PaymentMethod[] = ["DINHEIRO", "PIX", "DEBITO"];

// Repasse típico da adquirente no crédito à vista. Não é configurável ainda —
// quando for, este é o número que vira campo.
const DIAS_REPASSE_CREDITO = 30;

export function toCents(reais: number): number {
  return Math.round(reais * 100);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Quando cada forma vira dinheiro em caixa.
 *
 * Dinheiro/PIX/débito já entraram: nascem PAGOS. Crédito nasce PENDENTE com
 * vencimento no repasse. Boleto, transferência e "outros" não liquidam no
 * balcão e também nascem pendentes — sem data melhor que a da venda, porque o
 * prazo real não chega até aqui.
 */
export function settlementFor(
  method: PaymentMethod,
  saleDate: Date,
): { status: "PENDING" | "PAID"; dueDate: Date; paidAt: Date | null } {
  if (LIQUIDA_NA_HORA.includes(method)) {
    return { status: "PAID", dueDate: saleDate, paidAt: saleDate };
  }
  if (method === "CREDITO") {
    return {
      status: "PENDING",
      dueDate: addDays(saleDate, DIAS_REPASSE_CREDITO),
      paidAt: null,
    };
  }
  return { status: "PENDING", dueDate: saleDate, paidAt: null };
}

export interface BuildSaleEntriesArgs {
  saleNumber: number;
  saleDate: Date;
  /** Formas de pagamento em REAIS, como o PDV envia. */
  payments: { method: PaymentMethod; amount: number }[];
  /** Total da venda em REAIS — âncora do arredondamento. */
  total: number;
  /** Custo das mercadorias vendidas, em REAIS. Zero ou menos não vira linha. */
  cmv: number;
}

export function buildSaleEntries({
  saleNumber,
  saleDate,
  payments,
  total,
  cmv,
}: BuildSaleEntriesArgs): SaleEntryDraft[] {
  const drafts: SaleEntryDraft[] = [];

  // Converter cada forma isoladamente pode fazer a soma escapar um centavo do
  // total. Ancoramos no total e jogamos a diferença na última linha — no
  // financeiro, um centavo órfão vira divergência de conciliação.
  const totalCents = toCents(total);
  const cents = payments.map((payment) => toCents(payment.amount));
  const somaCents = cents.reduce((sum, value) => sum + value, 0);
  if (cents.length > 0 && somaCents !== totalCents) {
    cents[cents.length - 1] += totalCents - somaCents;
  }

  payments.forEach((payment, index) => {
    const amount = cents[index];
    if (amount <= 0) return;
    const { status, dueDate, paidAt } = settlementFor(payment.method, saleDate);
    drafts.push({
      saleEntryKey: `pag-${index}`,
      type: "RECEIVABLE",
      status,
      description: `Venda #${saleNumber} — ${payment.method}`,
      amount,
      paidAmount: status === "PAID" ? amount : 0,
      dueDate,
      paidAt,
      competenceDate: saleDate,
      categoryKind: "REVENUE",
    });
  });

  const cmvCents = toCents(cmv);
  if (cmvCents > 0) {
    drafts.push({
      saleEntryKey: "cmv",
      type: "PAYABLE",
      // PAGO, não pendente: a mercadoria foi comprada lá atrás. Deixar aberto
      // encheria "contas a pagar" de dívida que não existe — aqui o lançamento
      // serve para o DRE ter custo, e sem custo a margem sairia 100%.
      status: "PAID",
      description: `Venda #${saleNumber} — custo das mercadorias`,
      amount: cmvCents,
      paidAmount: cmvCents,
      dueDate: saleDate,
      paidAt: saleDate,
      competenceDate: saleDate,
      categoryKind: "COST",
    });
  }

  return drafts;
}
