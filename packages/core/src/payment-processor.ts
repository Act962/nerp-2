import type { PaymentRequest, PaymentSnapshot } from "./payment";

/**
 * Port de PROCESSAMENTO de pagamento — a abstração principal.
 *
 * O processador é DONO do ciclo da transação; COMO ele chega ao resultado
 * (polling interno, eventos push, webhook) é problema do adapter. O domínio do
 * PDV só sabe: "iniciei um pagamento e quero saber o estado dele". Por isso não
 * há orquestração de polling aqui.
 *
 * `PaymentProcessor` é a abstração; um TERMINAL (TEF) é apenas UMA implementação
 * possível — outras: adquirente específico, PIX via QR, maquininha integrada.
 * Adapters nomeiam a tecnologia (ex.: `TefPaymentTerminal`, `AsaasPixProcessor`).
 */
export interface PaymentProcessor {
  /** Inicia um pagamento; devolve o snapshot inicial (`pending`/`in_progress`). */
  start(request: PaymentRequest): Promise<PaymentSnapshot>;
  /** Estado atual de um pagamento já iniciado. */
  status(paymentId: string): Promise<PaymentSnapshot>;
  /** Tenta abortar um pagamento em andamento. */
  cancel(paymentId: string): Promise<PaymentSnapshot>;
  /**
   * Reconcilia um pagamento em `timeout`: descobre o desfecho real (aprovado ou
   * recusado) que o PDV não chegou a receber. Nunca assumir "não pagou". O
   * resultado PODE permanecer desconhecido — seguir `timeout` (ainda
   * reconciliável) ou virar `error` se a própria reconciliação falhar; nesse
   * caso a venda continua sem poder ser finalizada.
   */
  reconcile(paymentId: string): Promise<PaymentSnapshot>;
}
