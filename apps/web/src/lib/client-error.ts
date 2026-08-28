/**
 * Erro de carregamento de chunk: o navegador pediu um pedaço de JS que não
 * existe mais no servidor.
 *
 * É a causa mais comum de "Application error" INTERMITENTE em produção. O PDV
 * fica aberto o dia inteiro na mesma aba; quando sai um deploy, o build muda de
 * hash e os chunks que aquela aba ainda vai pedir somem. A tela quebra sem
 * ninguém ter feito nada de errado — por isso "de vez em quando", e por isso
 * costuma acontecer em grupo, logo após uma publicação.
 *
 * Recarregar resolve, porque a aba passa a buscar o HTML novo.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "ChunkLoadError") return true;
  return [
    /loading chunk \S+ failed/i,
    /loading css chunk/i,
    /failed to fetch dynamically imported module/i,
    /importing a module script failed/i,
    /error loading dynamically imported module/i,
  ].some((pattern) => pattern.test(error.message));
}

const RELOAD_KEY = "nerp:chunk-reload-at";
const RELOAD_COOLDOWN_MS = 10_000;

/**
 * Recarrega a página uma vez para buscar o build novo. O carimbo de tempo
 * impede o laço infinito: se o erro voltar logo depois do reload, não é chunk
 * velho e sim bug de verdade — aí a tela de erro aparece em vez de recarregar
 * para sempre. Passados os 10s, uma nova ocorrência pode recarregar de novo.
 */
export function tryReloadOnce(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage bloqueado (aba anônima com restrição): recarrega mesmo
    // assim, uma vez só é melhor que tela branca.
  }
  try {
    window.location.reload();
    return true;
  } catch {
    // Um boundary cujo próprio efeito lança escalaria o erro para o boundary
    // de cima — exatamente a tela branca que este código existe para evitar.
    return false;
  }
}
