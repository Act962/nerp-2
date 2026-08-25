import {
  createMockPaymentProcessor,
  isInFlight,
  type MockOutcome,
  type PaymentInstrument,
  type PaymentProcessor,
  type PaymentRequest,
  type PaymentSnapshot,
} from "@nerp/core";
import type { PaymentMethod } from "@nerp/types";

/**
 * Processador de pagamento do device.
 *
 * Hoje só existe o Mock (não há adapter de maquininha real ainda). Quando um
 * `TefPaymentTerminal`/adquirente existir, ele entra aqui gated por `isNative()`
 * — mesmo padrão de `getCatalog()`/`getOutbox()`. O polling do ciclo é do
 * CONSUMIDOR (`capturePayment`), não do domínio.
 */

// Dev/simulação: enquanto o processor é o Mock, permite o tester escolher o
// desfecho (aprovar/recusar/timeout) para exercitar o fluxo no app rodando.
let mockOutcome: MockOutcome = "approve";
export function setMockOutcome(outcome: MockOutcome): void {
  mockOutcome = outcome;
}
export function getMockOutcome(): MockOutcome {
  return mockOutcome;
}

let processorPromise: Promise<PaymentProcessor> | null = null;
export function getPaymentProcessor(): Promise<PaymentProcessor> {
  processorPromise ??= Promise.resolve(
    createMockPaymentProcessor({
      outcome: () => mockOutcome,
      pollsUntilResolve: 2, // um "processando…" curto antes de resolver
    }),
  );
  return processorPromise;
}

/** Instrumento do domínio → forma de pagamento de persistência (`SalePayment`). */
const INSTRUMENT_METHOD: Record<PaymentInstrument, PaymentMethod> = {
  credit: "CREDITO",
  debit: "DEBITO",
  pix: "PIX",
  voucher: "OUTROS",
};
export function instrumentToMethod(
  instrument: PaymentInstrument,
): PaymentMethod {
  return INSTRUMENT_METHOD[instrument];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type CaptureOptions = {
  pollIntervalMs?: number;
  onSnapshot?: (snapshot: PaymentSnapshot) => void;
};

/**
 * Captura um pagamento eletrônico: inicia no processor e faz POLLING em
 * `status()` até sair de "em voo" (resolvido OU timeout). O polling vive AQUI
 * (consumidor), não no domínio. Não decide nada sobre a venda — devolve o
 * snapshot final para a UI reagir (aprovado / recusado / erro / timeout).
 */
export async function capturePayment(
  request: PaymentRequest,
  opts: CaptureOptions = {},
): Promise<PaymentSnapshot> {
  const processor = await getPaymentProcessor();
  const pollIntervalMs = opts.pollIntervalMs ?? 400;

  let snapshot = await processor.start(request);
  opts.onSnapshot?.(snapshot);

  while (isInFlight(snapshot.state)) {
    await sleep(pollIntervalMs);
    snapshot = await processor.status(snapshot.id);
    opts.onSnapshot?.(snapshot);
  }
  return snapshot;
}

/** Reconcilia um pagamento em `timeout` (descobre se aprovou/recusou). */
export async function reconcilePayment(
  paymentId: string,
): Promise<PaymentSnapshot> {
  const processor = await getPaymentProcessor();
  return processor.reconcile(paymentId);
}
