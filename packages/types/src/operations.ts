/**
 * Envelope de OPERAÇÃO — o contrato do sync offline (device → server).
 *
 * Definido já na Fase 0 para o desktop nascer sabendo o formato, mesmo que o
 * replay só entre em uso na Fase 3. Cada operação é um COMANDO que será
 * reproduzido chamando o procedure oRPC correspondente, com `id` como chave de
 * idempotência.
 */
import type { PaymentMethod } from "./enums";

export type OperationType =
  | "sale.create"
  | "cashSession.open"
  | "cash.sangria"
  | "cash.suprimento"
  | "cashSession.close"
  | "stock.adjust";

export type SaleCreatePayload = {
  /** Âncora local da sessão de caixa OPEN que recebe a venda (caixa obrigatório). */
  clientSessionId: string;
  customerId?: string;
  priceListId?: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payments: Array<{ method: PaymentMethod; amount: number }>;
  items: Array<{ productId: string; productName: string; quantity: number }>;
};

// Vocabulário alinhado ao servidor (openingBalance/countedBalance/registerName).
// O `operationId` do envelope é o `clientSessionId` da sessão (abertura).
export type CashSessionOpenPayload = {
  openingBalance: number;
  registerName: string;
};
export type CashMovementPayload = {
  clientSessionId: string;
  amount: number;
  description?: string;
};
export type CashSessionClosePayload = {
  clientSessionId: string;
  countedBalance: number;
  notes?: string;
};
export type StockAdjustPayload = {
  productId: string;
  delta: number;
  reason?: string;
};

export type OperationPayload = {
  "sale.create": SaleCreatePayload;
  "cashSession.open": CashSessionOpenPayload;
  "cash.sangria": CashMovementPayload;
  "cash.suprimento": CashMovementPayload;
  "cashSession.close": CashSessionClosePayload;
  "stock.adjust": StockAdjustPayload;
};

export type OperationEnvelope<T extends OperationType = OperationType> = {
  /** uuid v7 — chave de idempotência e ordenação temporal. */
  id: string;
  deviceId: string;
  /** Roteamento LOCAL apenas. O server IGNORA e usa o principal autenticado. */
  orgId: string;
  type: T;
  payload: OperationPayload[T];
  /** Versão do contrato desta operação (para expandir sem quebrar fila antiga). */
  schemaVersion: number;
  /** ISO. Auditoria/ordenação — não é a verdade de negócio (essa é do server). */
  createdAt: string;
};

/** Estado de uma operação na outbox local do device. */
export type OperationStatus = "pending" | "syncing" | "done" | "conflict";
