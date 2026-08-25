import type { PaymentMethod } from "@nerp/types";
import { enqueueOp } from "./sync";

/** Payload de uma venda offline (o que vai na outbox e, no replay, ao server). */
export type SalePayload = {
  /** Âncora local da sessão de caixa OPEN (caixa obrigatório para vender). */
  clientSessionId: string;
  discount: number;
  total: number;
  status: "COMPLETED";
  soldAt: string;
  payments: Array<{ method: PaymentMethod; amount: number }>;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
};

/**
 * Finaliza uma venda: grava na outbox local (offline-first, nunca perde) e
 * devolve o operationId. O drain (em `sync.ts`) leva ao server depois, em ordem.
 */
export function enqueueSale(payload: SalePayload): Promise<string> {
  return enqueueOp("sale.create", payload);
}
