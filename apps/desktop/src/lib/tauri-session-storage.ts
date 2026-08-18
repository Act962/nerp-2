import { load } from "@tauri-apps/plugin-store";
import type { SessionStorage, StoredSession } from "./token-store";

/**
 * Storage da sessão no app NATIVO (Tauri), num arquivo do app-data via
 * `@tauri-apps/plugin-store`. ⚠️ Só roda dentro do Tauri (import dinâmico).
 *
 * Persistência app-scoped — melhor que localStorage para um app instalado, mas
 * NÃO criptografada. O upgrade para keychain do SO (Stronghold) é follow-up;
 * ver os passos de wiring no README do desktop.
 */
const KEY = "session";

export async function createTauriSessionStorage(): Promise<SessionStorage> {
  const store = await load("nerp-session.json");
  return {
    async read() {
      return (await store.get<StoredSession>(KEY)) ?? null;
    },
    async write(session) {
      await store.set(KEY, session);
      await store.save();
    },
    async clear() {
      await store.delete(KEY);
      await store.save();
    },
  };
}
