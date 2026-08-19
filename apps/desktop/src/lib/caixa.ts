import {
  type CashSessionStore,
  type CashSummary,
  createIndexedDbCashSessionStore,
  type LocalCashSession,
  type Operator,
  summarizeCash,
} from "@nerp/core";
import type { PaymentMethod } from "@nerp/types";
import { isNative } from "./platform";
import { drainAll, enqueueOp } from "./sync";

/**
 * Caixa local do device (mesmo padrão de `getCatalog`/`getOutbox`): SQLite no
 * nativo, IndexedDB no web/dev. Cada ação (abrir/sangria/suprimento/fechar)
 * PERSISTE no store local e enfileira a operação na MESMA outbox das vendas —
 * a ordem causal (abrir→vender→…→fechar) é preservada pelo drain estrito.
 */
let storePromise: Promise<CashSessionStore> | null = null;
export function getCashSessionStore(): Promise<CashSessionStore> {
  storePromise ??= (async () => {
    if (isNative()) {
      const { createSqliteCashSessionStore } = await import(
        "@nerp/core/sqlite-cash-session"
      );
      return createSqliteCashSessionStore();
    }
    return createIndexedDbCashSessionStore();
  })();
  return storePromise;
}

/** A sessão de caixa corrente (aberta ou recém-fechada), ou null. */
export async function currentSession(): Promise<LocalCashSession | null> {
  return (await getCashSessionStore()).getCurrent();
}

const nowIso = () => new Date().toISOString();

export async function openCaixa(params: {
  openingBalance: number;
  registerName: string;
  operator: Operator;
  openingNotes?: string;
}): Promise<LocalCashSession> {
  const store = await getCashSessionStore();
  const existing = await store.getCurrent();
  if (existing && existing.status === "open")
    throw new Error("Já existe um caixa aberto neste terminal.");

  // O operationId da abertura É o clientSessionId (âncora do replay e da venda).
  const openedAt = nowIso();
  const clientSessionId = crypto.randomUUID();
  const session: LocalCashSession = {
    clientSessionId,
    openingBalance: params.openingBalance,
    openedBy: params.operator,
    openedAt,
    registerName: params.registerName,
    status: "open",
    movements: [
      { kind: "ABERTURA", amount: params.openingBalance, createdAt: openedAt },
    ],
  };
  await store.open(session);
  await enqueueOp(
    "cashSession.open",
    {
      openingBalance: params.openingBalance,
      registerName: params.registerName,
      openedAt,
      openingNotes: params.openingNotes,
    },
    clientSessionId,
  );
  await drainAll();
  return session;
}

async function movement(
  kind: "SANGRIA" | "SUPRIMENTO",
  type: "cash.sangria" | "cash.suprimento",
  amount: number,
  description?: string,
): Promise<void> {
  const store = await getCashSessionStore();
  const cur = await store.getCurrent();
  if (!cur || cur.status !== "open") throw new Error("Nenhum caixa aberto.");
  const operationId = crypto.randomUUID();
  await store.addMovement({
    kind,
    amount,
    clientOperationId: operationId,
    description,
    createdAt: nowIso(),
  });
  await enqueueOp(
    type,
    { clientSessionId: cur.clientSessionId, kind, amount, description },
    operationId,
  );
  await drainAll();
}

export function sangria(amount: number, description?: string) {
  return movement("SANGRIA", "cash.sangria", amount, description);
}
export function suprimento(amount: number, description?: string) {
  return movement("SUPRIMENTO", "cash.suprimento", amount, description);
}

/** Registra a venda no livro local (VENDA por forma) — para o esperado da gaveta. */
export async function recordSale(
  payments: Array<{ method: PaymentMethod; amount: number }>,
): Promise<void> {
  const store = await getCashSessionStore();
  const cur = await store.getCurrent();
  if (!cur || cur.status !== "open") return;
  const createdAt = nowIso();
  for (const p of payments) {
    await store.addMovement({
      kind: "VENDA",
      amount: p.amount,
      paymentMethod: p.method,
      createdAt,
    });
  }
}

/**
 * Fecha o caixa (contagem cega). Calcula o esperado LOCAL (para revelar a
 * diferença na hora); o servidor recalcula como autoridade no replay.
 */
export async function closeCaixa(
  countedBalance: number,
  closingNotes?: string,
): Promise<
  CashSummary & { difference: number; openingBalance: number; counted: number }
> {
  const store = await getCashSessionStore();
  const cur = await store.getCurrent();
  if (!cur || cur.status !== "open") throw new Error("Nenhum caixa aberto.");

  const summary = summarizeCash(cur.openingBalance, cur.movements);
  const difference = countedBalance - summary.expectedCash;
  const closedAt = nowIso();
  await store.close(countedBalance, closedAt);
  await enqueueOp("cashSession.close", {
    clientSessionId: cur.clientSessionId,
    countedBalance,
    closedAt,
    closingNotes,
  });
  await drainAll();
  return {
    ...summary,
    difference,
    openingBalance: cur.openingBalance,
    counted: countedBalance,
  };
}

/** Descarta a sessão fechada do store (para abrir uma nova). */
export async function clearSession(): Promise<void> {
  await (await getCashSessionStore()).clear();
}
