import {
  canTransitionPayment,
  type PaymentRequest,
  type PaymentSnapshot,
  type PaymentState,
} from "../payment";
import type { PaymentProcessor } from "../payment-processor";

/** Desfecho que o mock vai simular para um pagamento. */
export type MockOutcome = "approve" | "decline" | "timeout" | "error";

export type MockPaymentProcessorConfig = {
  /** Desfecho fixo, ou resolvido por requisição. Default: "approve". */
  outcome?: MockOutcome | ((request: PaymentRequest) => MockOutcome);
  /** Quantas consultas em `in_progress` antes de resolver. Default: 1. */
  pollsUntilResolve?: number;
  /** Para onde a reconciliação de um `timeout` leva. Default: "approve". */
  reconcileTo?: "approve" | "decline";
  /** Relógio injetável (ISO) para timestamps determinísticos nos testes. */
  now?: () => string;
  /** Gerador de id injetável. */
  id?: () => string;
};

const OUTCOME_STATE: Record<MockOutcome, PaymentState> = {
  approve: "approved",
  decline: "declined",
  timeout: "timeout",
  error: "error",
};

type Entry = {
  snapshot: PaymentSnapshot;
  outcome: MockOutcome;
  polls: number;
  pollsUntilResolve: number;
};

/**
 * Adapter de mentira do `PaymentProcessor` — o PRIMEIRO adapter, para exercitar
 * a arquitetura sem maquininha real. Determinístico: resolve por CONTAGEM de
 * consultas (não por relógio), e `id`/`now` são injetáveis — nada de
 * `Math.random`.
 *
 * Simula os desfechos exigidos: sucesso (`approve`), erro (`error`) e `timeout`
 * — que NÃO é recusa: `reconcile()` depois revela o desfecho real. Toda
 * transição passa por `canTransitionPayment`.
 */
export function createMockPaymentProcessor(
  config: MockPaymentProcessorConfig = {},
): PaymentProcessor {
  const nowIso = config.now ?? (() => new Date().toISOString());
  let seq = 0;
  const genId =
    config.id ??
    (() => {
      seq += 1;
      return `mock-pay-${seq}`;
    });
  const pollsUntilResolve = Math.max(1, config.pollsUntilResolve ?? 1);
  const reconcileTo = config.reconcileTo ?? "approve";
  const resolveOutcome = (request: PaymentRequest): MockOutcome =>
    typeof config.outcome === "function"
      ? config.outcome(request)
      : (config.outcome ?? "approve");

  const store = new Map<string, Entry>();

  const get = (paymentId: string): Entry => {
    const entry = store.get(paymentId);
    if (!entry) throw new Error(`Pagamento não encontrado: ${paymentId}`);
    return entry;
  };

  const transition = (entry: Entry, to: PaymentState): PaymentSnapshot => {
    if (!canTransitionPayment(entry.snapshot.state, to)) {
      throw new Error(
        `Transição de pagamento inválida: ${entry.snapshot.state} → ${to}`,
      );
    }
    const approving = to === "approved";
    entry.snapshot = {
      ...entry.snapshot,
      state: to,
      updatedAt: nowIso(),
      // Evidências preenchidas SÓ na aprovação — como um adquirente real faria.
      externalTransactionId: approving
        ? `MOCK-TX-${entry.snapshot.id}`
        : entry.snapshot.externalTransactionId,
      authorization: approving
        ? `AUTH-${entry.snapshot.id}`
        : entry.snapshot.authorization,
      nsu: approving ? `NSU-${entry.snapshot.id}` : entry.snapshot.nsu,
      message:
        to === "declined"
          ? "Recusado pelo emissor (simulado)"
          : to === "error"
            ? "Falha no processador (simulado)"
            : entry.snapshot.message,
    };
    return entry.snapshot;
  };

  return {
    async start(request) {
      const id = genId();
      const iso = nowIso();
      const snapshot: PaymentSnapshot = {
        id,
        state: "in_progress",
        request,
        provider: "mock",
        createdAt: iso,
        updatedAt: iso,
      };
      store.set(id, {
        snapshot,
        outcome: resolveOutcome(request),
        polls: 0,
        pollsUntilResolve,
      });
      return snapshot;
    },

    async status(paymentId) {
      const entry = get(paymentId);
      if (entry.snapshot.state !== "in_progress") return entry.snapshot;
      entry.polls += 1;
      if (entry.polls < entry.pollsUntilResolve) return entry.snapshot;
      return transition(entry, OUTCOME_STATE[entry.outcome]);
    },

    async cancel(paymentId) {
      const entry = get(paymentId);
      // Já resolvido (approved/declined/error/timeout): cancelar é no-op.
      if (!canTransitionPayment(entry.snapshot.state, "cancelled")) {
        return entry.snapshot;
      }
      return transition(entry, "cancelled");
    },

    async reconcile(paymentId) {
      const entry = get(paymentId);
      if (entry.snapshot.state !== "timeout") return entry.snapshot;
      return transition(
        entry,
        reconcileTo === "approve" ? "approved" : "declined",
      );
    },
  };
}
