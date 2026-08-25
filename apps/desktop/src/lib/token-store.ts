/**
 * Guarda a sessão do device (token + org pareada).
 *
 * Abstração com cache em memória: a leitura do storage é assíncrona (para
 * suportar keychain no nativo), mas `getCurrentToken()` é síncrono para o
 * cliente oRPC não pagar um I/O por request.
 *
 * - Web/dev: `localStorage`.
 * - Tauri (nativo): `@tauri-apps/plugin-store` (arquivo no app-data), carregado
 *   por import dinâmico — não entra no bundle web. É persistência app-scoped, um
 *   degrau acima do localStorage; o keychain criptografado (Stronghold) é o
 *   próximo passo (ver README).
 */
import { isNative } from "./platform";

export type StoredSession = {
  token: string;
  organizationId: string;
  organizationName: string;
  /** Operador pareado (para a barra de caixa) e o nome do terminal (= register). */
  operatorName: string;
  registerName: string;
};

export interface SessionStorage {
  read(): Promise<StoredSession | null>;
  write(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

const KEY = "nerp.device.session";

const localStorageBacked: SessionStorage = {
  async read() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  },
  async write(session) {
    localStorage.setItem(KEY, JSON.stringify(session));
  },
  async clear() {
    localStorage.removeItem(KEY);
  },
};

let storagePromise: Promise<SessionStorage> | null = null;
function storage(): Promise<SessionStorage> {
  storagePromise ??= (async () => {
    if (isNative()) {
      const { createTauriSessionStorage } = await import(
        "./tauri-session-storage"
      );
      return createTauriSessionStorage();
    }
    return localStorageBacked;
  })();
  return storagePromise;
}

let current: StoredSession | null = null;

/** Carrega a sessão do storage para o cache. Chamada no boot do app. */
export async function loadSession(): Promise<StoredSession | null> {
  current = await (await storage()).read();
  return current;
}

/** Token atual, síncrono (lê o cache). Usado pelo cliente oRPC. */
export function getCurrentToken(): string | null {
  return current?.token ?? null;
}

export async function persistSession(session: StoredSession): Promise<void> {
  current = session;
  await (await storage()).write(session);
}

export async function clearSession(): Promise<void> {
  current = null;
  await (await storage()).clear();
}
