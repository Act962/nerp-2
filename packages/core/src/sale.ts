/**
 * Domínio da VENDA no device — máquina de estados do ciclo de checkout, PURA.
 *
 * Distinta do `SaleStatus` do servidor (DRAFT/COMPLETED/…): aqui é o ciclo LOCAL
 * do PDV, do carrinho até entrar na outbox. A venda sabe "quanto precisa
 * receber"; os pagamentos (dinheiro manual + transações aprovadas do
 * `PaymentProcessor`) dizem "quanto já foi aprovado". Os dois são separados.
 */

export type SaleState =
  | "draft" // montando o carrinho
  | "awaiting_payment" // checkout iniciado, capturando pagamentos
  | "paid" // pagamentos cobrem o total, pronto para enfileirar
  | "enqueued" // gravada na outbox (replicará ao servidor)
  | "cancelled";

export const SALE_TRANSITIONS: Record<SaleState, readonly SaleState[]> = {
  draft: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["paid", "draft", "cancelled"],
  paid: ["enqueued", "cancelled"],
  enqueued: [],
  cancelled: [],
};

export function canTransitionSale(from: SaleState, to: SaleState): boolean {
  return SALE_TRANSITIONS[from].includes(to);
}

/**
 * Um pagamento da venda, abstraindo a ORIGEM: dinheiro (tender manual, aprovado
 * na hora pelo operador) ou uma transação aprovada de um `PaymentProcessor`.
 */
export type Tender = {
  amount: number;
  approved: boolean;
};

/** Tolerância de arredondamento (R$ 0,01). */
const EPSILON = 0.01;

/**
 * A venda está paga quando a soma dos tenders APROVADOS cobre o total (dentro da
 * tolerância). É a cola mínima entre os dois agregados — não decide COMO cobrar.
 */
export function isFullyPaid(total: number, tenders: Tender[]): boolean {
  const paid = tenders
    .filter((tender) => tender.approved)
    .reduce((sum, tender) => sum + tender.amount, 0);
  return paid + EPSILON >= total;
}
