/**
 * Guarda a sessão do device (token + org pareada).
 *
 * Fase 1: `localStorage` — simples e suficiente para validar o fluxo. Na Fase 4
 * de endurecimento isto vira o keychain do SO (tauri-plugin-stronghold/keyring);
 * a interface abaixo é o ponto único de troca, o resto do app não muda.
 */
export type StoredSession = {
  token: string;
  organizationId: string;
  organizationName: string;
};

const KEY = "nerp.device.session";

export function getStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function setStoredSession(session: StoredSession): void {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  localStorage.removeItem(KEY);
}
