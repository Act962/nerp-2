/**
 * `localStorage` que nunca derruba a página: navegação anônima, cota cheia ou
 * armazenamento bloqueado viram "não lembro", e o site segue.
 */
export function lerLocal(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function gravarLocal(chave: string, valor: string | null) {
  try {
    if (valor === null) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, valor);
  } catch {
    // Sem armazenamento, cada página vira uma visita nova. Aceitável.
  }
}
