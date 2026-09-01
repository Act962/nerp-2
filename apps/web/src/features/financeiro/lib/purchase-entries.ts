import { toCents } from "./sale-entries";

/**
 * Tradução de uma ENTRADA DE NOTA para lançamentos do Financeiro.
 *
 * A compra vira N contas a pagar — as duplicatas da nota do fornecedor. É o
 * espelho de `sale-entries.ts`, com duas diferenças de domínio que valem estar
 * escritas:
 *
 * 1. Nasce sempre PENDENTE, nunca paga. Na venda, dinheiro/PIX/débito já
 *    entraram no balcão. Aqui não: "à vista" no papel não quer dizer que o
 *    dinheiro saiu — a nota costuma ser digitada dias depois do recebimento e o
 *    pagamento sai pelo banco. Nascer paga afirmaria um pagamento que ninguém
 *    fez. Quem liquida é o Financeiro.
 * 2. Não entra no resultado. Comprar mercadoria é trocar caixa por ativo; o
 *    DRE só é atingido na venda, via CMV, que `sale-entries.ts` já lança. Quem
 *    cuida disso é a categoria, com `excludeFromResult` ligado.
 *
 * Módulo puro: sem Prisma, sem I/O. A gravação fica em
 * `server/purchase-entries.ts`.
 */

export interface PurchaseEntryDraft {
  /** Discrimina a parcela dentro da nota. Chave de idempotência. */
  purchaseEntryKey: string;
  description: string;
  /** Em CENTAVOS — é como o Financeiro guarda dinheiro. */
  amount: number;
  dueDate: Date;
  /**
   * Data que os relatórios usam para agrupar: a do recebimento da mercadoria,
   * não a do vencimento. Uma nota recebida em janeiro e paga em março é fato
   * de janeiro.
   */
  competenceDate: Date;
  installmentTotal: number | null;
  installmentCurrent: number | null;
}

/**
 * Soma meses preservando o fim do mês.
 *
 * `setMonth` puro transborda: 31/01 + 1 mês vira 03/03. Numa régua de
 * vencimentos isso empurra a parcela para depois do mês que ela deveria
 * fechar.
 */
function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDayOfMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(day, lastDayOfMonth));
  return next;
}

export interface BuildPurchaseEntriesArgs {
  purchaseNumber: number;
  /** Número da NF do fornecedor, quando houver. */
  invoiceNumber: string | null;
  /** Total da nota em REAIS — âncora do arredondamento. */
  total: number;
  installments: number;
  /** Vencimento da 1ª parcela. Ausente = vence no recebimento. */
  firstDueDate: Date | null;
  receivedAt: Date;
}

export function buildPurchaseEntries({
  purchaseNumber,
  invoiceNumber,
  total,
  installments,
  firstDueDate,
  receivedAt,
}: BuildPurchaseEntriesArgs): PurchaseEntryDraft[] {
  const totalCents = toCents(total);
  if (totalCents <= 0) return [];

  const count = Math.max(1, Math.trunc(installments));
  // Mesmo rateio do lançamento manual (`router/financeiro/entries.ts`): o resto
  // vai inteiro na ÚLTIMA parcela. Divergir dele faria os dois caminhos
  // fecharem o mesmo total com centavos diferentes.
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;

  const documento = invoiceNumber ? ` — NF ${invoiceNumber}` : "";
  const first = firstDueDate ?? receivedAt;

  return Array.from({ length: count }, (_, index) => {
    const parcela = count > 1 ? ` (${index + 1}/${count})` : "";
    return {
      purchaseEntryKey: `parcela-${index}`,
      description: `Compra #${purchaseNumber}${documento}${parcela}`,
      amount: base + (index === count - 1 ? remainder : 0),
      dueDate: addMonths(first, index),
      competenceDate: receivedAt,
      installmentTotal: count > 1 ? count : null,
      installmentCurrent: count > 1 ? index + 1 : null,
    };
  });
}
