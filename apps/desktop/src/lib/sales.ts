import { createIndexedDbOutbox, drainOutbox, type Outbox } from "@nerp/core";
import { client } from "./client";

/** Payload de uma venda offline (o que vai na outbox e, no replay, ao server). */
export type SalePayload = {
  discount: number;
  total: number;
  status: "COMPLETED";
  soldAt: string;
  payments: Array<{ method: "DINHEIRO"; amount: number }>;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
};

let outboxPromise: Promise<Outbox> | null = null;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export function getOutbox(): Promise<Outbox> {
  outboxPromise ??= (async () => {
    if (isTauri()) {
      const { createSqliteOutbox } = await import("@nerp/core/sqlite-outbox");
      return createSqliteOutbox();
    }
    return createIndexedDbOutbox();
  })();
  return outboxPromise;
}

/**
 * Finaliza uma venda: grava na outbox local (funciona offline, nunca perde) e
 * devolve o operationId. O drain leva ao server depois.
 */
export async function enqueueSale(payload: SalePayload): Promise<string> {
  const outbox = await getOutbox();
  const operationId = crypto.randomUUID();
  await outbox.enqueue({ id: operationId, type: "sale.create", payload });
  return operationId;
}

/** Drena a outbox: replica cada venda pendente via o replay idempotente. */
export function drainSales() {
  return getOutbox().then((outbox) =>
    drainOutbox(outbox, (item) =>
      client.sales.createFromDevice({
        operationId: item.id,
        ...(item.payload as SalePayload),
      }),
    ),
  );
}

export async function countPendingSales(): Promise<number> {
  return (await getOutbox()).countPending();
}

/** Vendas que esgotaram as tentativas (dead-letter) — para a UI e o retry. */
export async function listFailedSales() {
  return (await getOutbox()).failed();
}

/** Re-arma uma venda em falha: volta para pending (attempts 0) e tenta drenar. */
export async function retrySale(id: string) {
  const outbox = await getOutbox();
  await outbox.update(id, {
    status: "pending",
    attempts: 0,
    lastError: undefined,
  });
  return drainSales();
}
