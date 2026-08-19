import {
  createIndexedDbOutbox,
  drainOutbox,
  type Outbox,
  type OutboxItem,
} from "@nerp/core";
import { client } from "./client";
import { isNative } from "./platform";

/**
 * Outbox única do device + drain que despacha cada operação para o procedure
 * certo por TIPO. Venda e caixa compartilham a MESMA fila — é isso que garante a
 * ordenação causal (OPEN→VENDA→SANGRIA→CLOSE) que o `drainOutbox` estrito
 * preserva. Os tipos dos payloads vêm do próprio client (contrato `DesktopApi`),
 * então não há duplicação.
 */
let outboxPromise: Promise<Outbox> | null = null;
export function getOutbox(): Promise<Outbox> {
  outboxPromise ??= (async () => {
    if (isNative()) {
      const { createSqliteOutbox } = await import("@nerp/core/sqlite-outbox");
      return createSqliteOutbox();
    }
    return createIndexedDbOutbox();
  })();
  return outboxPromise;
}

/** Enfileira uma operação. `id` é o `operationId` (idempotência); reusado no retry. */
export async function enqueueOp(
  type: string,
  payload: unknown,
  id: string = crypto.randomUUID(),
): Promise<string> {
  const outbox = await getOutbox();
  await outbox.enqueue({ id, type, payload });
  return id;
}

type SaleOp = Omit<
  Parameters<typeof client.sales.createFromDevice>[0],
  "operationId"
>;
type OpenOp = Omit<
  Parameters<typeof client.caixa.openFromDevice>[0],
  "operationId"
>;
type MoveOp = Omit<
  Parameters<typeof client.caixa.movementFromDevice>[0],
  "operationId"
>;
type CloseOp = Omit<
  Parameters<typeof client.caixa.closeFromDevice>[0],
  "operationId"
>;

// Despacha uma operação da outbox para o procedure oRPC correspondente. O
// `operationId` (= item.id) é reusado sempre — idempotência no timeout.
function replayOperation(item: OutboxItem): Promise<unknown> {
  const operationId = item.id;
  switch (item.type) {
    case "sale.create":
      return client.sales.createFromDevice({
        operationId,
        ...(item.payload as SaleOp),
      });
    case "cashSession.open":
      return client.caixa.openFromDevice({
        operationId,
        ...(item.payload as OpenOp),
      });
    case "cash.sangria":
    case "cash.suprimento":
      return client.caixa.movementFromDevice({
        operationId,
        ...(item.payload as MoveOp),
      });
    case "cashSession.close":
      return client.caixa.closeFromDevice({
        operationId,
        ...(item.payload as CloseOp),
      });
    default:
      return Promise.reject(new Error(`Operação desconhecida: ${item.type}`));
  }
}

/** Drena a fila inteira (venda + caixa), em ordem estrita. */
export function drainAll() {
  return getOutbox().then((outbox) => drainOutbox(outbox, replayOperation));
}

export async function countPending(): Promise<number> {
  return (await getOutbox()).countPending();
}

export async function listFailed() {
  return (await getOutbox()).failed();
}

/** Re-arma uma operação em falha (dead-letter) para pending e drena. */
export async function retryOp(id: string) {
  const outbox = await getOutbox();
  await outbox.update(id, {
    status: "pending",
    attempts: 0,
    lastError: undefined,
  });
  return drainAll();
}
