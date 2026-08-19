import type { LocalCashMovement, LocalCashSession } from "./cash-session";

/**
 * Store da sessão de caixa LOCAL do device — o "caixa aberto agora" e seus
 * movimentos. Mesmo padrão do `LocalCatalog`/`Outbox`: interface única, dois
 * storages por baixo (IndexedDB no web/dev, SQLite no Tauri nativo). PERSISTE:
 * um caixa aberto tem de sobreviver a um restart do app.
 *
 * Há no máximo UMA sessão corrente por vez (a regra "1 OPEN por operador" do
 * server; o device é um terminal). O `close` mantém a sessão (com o contado)
 * até o `clear` — para a UI mostrar o resultado e o replay drenar.
 */
export interface CashSessionStore {
  /** A sessão corrente (aberta ou recém-fechada aguardando limpeza), ou null. */
  getCurrent(): Promise<LocalCashSession | null>;
  /** Abre uma nova sessão (substitui a corrente). */
  open(session: LocalCashSession): Promise<void>;
  /** Anexa um movimento (venda/sangria/suprimento) à sessão corrente. */
  addMovement(movement: LocalCashMovement): Promise<void>;
  /** Fecha a sessão corrente (contagem cega): grava contado + fechamento. */
  close(countedBalance: number, closedAt: string): Promise<void>;
  /** Descarta a sessão corrente (após sincronizar/encerrar). */
  clear(): Promise<void>;
}
