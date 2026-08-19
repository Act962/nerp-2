import {
  type CashSessionStore,
  createIndexedDbCashSessionStore,
  type LocalCashSession,
} from "@nerp/core";
import { isNative } from "./platform";

/**
 * Store da sessão de caixa local do device (mesmo padrão de `getCatalog`/
 * `getOutbox`): SQLite no nativo, IndexedDB no web/dev.
 *
 * Corte 1 usa só a LEITURA (`currentSession`) para amarrar a venda à sessão e
 * bloquear a venda sem caixa aberto. As ações (abrir/sangria/suprimento/fechar)
 * e a UI entram no Corte 2.
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

/** A sessão de caixa corrente (aberta), ou null. */
export async function currentSession(): Promise<LocalCashSession | null> {
  return (await getCashSessionStore()).getCurrent();
}
