import type { OutboxItem } from "./types";

/**
 * Outbox local — a fila de operações feitas offline (hoje: vendas) esperando
 * replay no server. Mesmo padrão do `LocalCatalog`: interface única, dois
 * storages por baixo (IndexedDB / SQLite).
 */
export interface Outbox {
  /** Enfileira uma operação nova (status pending, attempts 0). */
  enqueue(op: { id: string; type: string; payload: unknown }): Promise<void>;
  /** Operações ainda pendentes, em ordem de criação (FIFO). */
  pending(): Promise<OutboxItem[]>;
  /** Operações que esgotaram as tentativas (dead-letter) — para a UI e o retry. */
  failed(): Promise<OutboxItem[]>;
  /** Atualiza campos de uma operação (status/attempts/result/erro). */
  update(id: string, patch: Partial<OutboxItem>): Promise<void>;
  /** Quantas pendentes (para o indicador "N vendas por sincronizar"). */
  countPending(): Promise<number>;
}

/** Tentativas antes de mandar a operação para o dead-letter (status failed). */
const MAX_ATTEMPTS = 5;

/**
 * Drena a outbox: replica cada pendente no server, em ordem.
 *
 * - Sucesso → marca `done` (guarda o resultado, ex.: o saleNumber do server).
 * - Falha transitória (rede) → incrementa `attempts`, mantém `pending` e PARA
 *   (provável queda de conexão; retoma no próximo drain). O replay é idempotente
 *   no server, então reenviar é seguro.
 * - Falha persistente (esgotou `MAX_ATTEMPTS`) → dead-letter (`failed`) e SEGUE
 *   para a próxima, para uma venda problemática não travar a fila inteira.
 */
export async function drainOutbox(
  outbox: Outbox,
  replay: (item: OutboxItem) => Promise<unknown>,
): Promise<{ synced: number; failed: number; remaining: number }> {
  const items = await outbox.pending();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const result = await replay(item);
      await outbox.update(item.id, { status: "done", result });
      synced += 1;
    } catch (error) {
      const attempts = item.attempts + 1;
      const message = error instanceof Error ? error.message : String(error);
      if (attempts >= MAX_ATTEMPTS) {
        await outbox.update(item.id, {
          attempts,
          lastError: message,
          status: "failed",
        });
        failed += 1;
        continue; // dead-letter: não trava as próximas
      }
      await outbox.update(item.id, { attempts, lastError: message });
      break; // provável conectividade: para e retoma depois
    }
  }

  return { synced, failed, remaining: await outbox.countPending() };
}
