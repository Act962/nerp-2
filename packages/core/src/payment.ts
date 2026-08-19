/**
 * Domínio de PAGAMENTO — tipos e máquina de estados, PUROS (sem I/O).
 *
 * Separa "pagamento" de "venda": um pagamento é um agregado próprio, com ciclo
 * de vida independente, produzido por um `PaymentProcessor` (o port). Aqui está
 * só o MODELO — nenhuma tecnologia (TEF, PIX, adquirente) aparece.
 */

/** Estados de um pagamento eletrônico. */
export type PaymentState =
  | "pending" // criado, ainda não iniciado no processador
  | "in_progress" // processador trabalhando (aguardando cartão/senha/aprovação)
  | "approved" // aprovado — resolvido
  | "declined" // recusado pelo emissor — NÃO é falha de sistema; resolvido
  | "cancelled" // cancelado pelo operador/processador — resolvido
  | "error" // falha de comunicação/processador — resolvido
  | "timeout"; // sem resposta no tempo — NÃO é recusa: exige reconciliação

/** Estados com desfecho conhecido e final. */
const RESOLVED: readonly PaymentState[] = [
  "approved",
  "declined",
  "cancelled",
  "error",
];

export function isResolved(state: PaymentState): boolean {
  return RESOLVED.includes(state);
}

export function isInFlight(state: PaymentState): boolean {
  return state === "pending" || state === "in_progress";
}

/**
 * `timeout` NÃO significa "não pagou": a maquininha pode ter aprovado e o PDV
 * perdido a resposta. É um estado NÃO resolvido que exige RECONCILIAÇÃO — nunca
 * tratar como recusa.
 */
export function requiresReconciliation(state: PaymentState): boolean {
  return state === "timeout";
}

/**
 * Instrumento que um processador ELETRÔNICO trata. Tipo PRÓPRIO do domínio de
 * pagamento — deliberadamente separado do `PaymentMethod` de `@nerp/types` (que
 * é meio/forma de PERSISTÊNCIA em `SalePayment` e inclui dinheiro/boleto).
 * Dinheiro é tender manual e não passa por processador, então não entra aqui.
 */
export type PaymentInstrument = "credit" | "debit" | "pix" | "voucher";

/** O que o PDV pede ao processador. */
export type PaymentRequest = {
  /** Valor a capturar, em reais (Decimal→number na borda, como o resto do core). */
  amount: number;
  instrument: PaymentInstrument;
  /** Parcelas (crédito); ausente ou 1 = à vista. */
  installments?: number;
  /** Referência opaca do PDV (id do tender/venda) para correlação. */
  reference?: string;
};

/** Retrato imutável de um pagamento num instante. */
export type PaymentSnapshot = {
  /** Id do pagamento no processador/adapter. */
  id: string;
  state: PaymentState;
  request: PaymentRequest;
  /** Código de autorização (adquirente real; o mock preenche fake ao aprovar). */
  authorization?: string;
  /** NSU (adquirente real; o mock preenche fake). */
  nsu?: string;
  /** Mensagem legível (motivo de recusa/erro). */
  message?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

/**
 * Transições legais do pagamento. `timeout` é reconciliável: um pagamento pode
 * ter aprovado sem o PDV saber, então dele ainda se chega a approved/declined.
 */
export const PAYMENT_TRANSITIONS: Record<
  PaymentState,
  readonly PaymentState[]
> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["approved", "declined", "cancelled", "timeout", "error"],
  timeout: ["approved", "declined", "error"],
  approved: [],
  declined: [],
  cancelled: [],
  error: [],
};

export function canTransitionPayment(
  from: PaymentState,
  to: PaymentState,
): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}
