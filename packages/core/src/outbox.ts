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
 * Drena a outbox: replica cada pendente no server, ESTRITAMENTE em ordem (FIFO).
 *
 * Ordenação causal (segurança transacional de PDV): as operações de uma sessão
 * de caixa formam uma cadeia — `OPEN → (VENDA|SANGRIA|SUPRIMENTO)* → CLOSE`. Uma
 * operação NUNCA pode ser replayada antes de uma anterior não-resolvida, senão o
 * server fecharia o caixa com valor errado, ou uma venda cairia numa sessão
 * inexistente. Por isso o drain PARA no primeiro item não-`done`:
 *
 * - Sucesso → marca `done` (guarda o resultado, ex.: o saleNumber do server).
 * - Falha transitória (rede) → incrementa `attempts`, mantém `pending` e PARA.
 * - Dead-letter (esgotou `MAX_ATTEMPTS`) → marca `failed` e PARA — NÃO pula os
 *   sucessores. Fica visível para a UI e volta à fila via retry (re-arma
 *   `pending`), que então libera o resto. Nunca vira falha permanente.
 *
 * O replay é idempotente no server (mesmo `operationId` → resultado existente),
 * então reenviar após timeout é seguro.
 */
export async function drainOutbox(
  outbox: Outbox,
  replay: (item: OutboxItem) => Promise<unknown>,
): Promise<{ synced: number; failed: number; remaining: number }> {
  // Se há um item morto na FRENTE da fila (dead-letter de um drain anterior),
  // nada depois dele pode drenar. Como o drain para no 1º não-resolvido, um item
  // `failed` é sempre o mais antigo pendente — logo bloqueia todos os seguintes.
  const stuck = await outbox.failed();
  if (stuck.length > 0) {
    return { synced: 0, failed: 0, remaining: await outbox.countPending() };
  }

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
      } else {
        await outbox.update(item.id, { attempts, lastError: message });
      }
      break; // estritamente em ordem: para no 1º item não-resolvido
    }
  }

  return { synced, failed, remaining: await outbox.countPending() };
}
