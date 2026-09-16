/**
 * O endereço de um passo casa com o da tela?
 *
 * Compara ignorando a barra final e a query: `/produtos` e `/produtos/` são a
 * mesma tela, e `?busca=arroz` no meio de uma jornada não pode derrubá-la.
 */
export function normalizarRota(rota: string): string {
  const semQuery = rota.split("?")[0].split("#")[0];
  if (semQuery.length > 1 && semQuery.endsWith("/")) {
    return semQuery.slice(0, -1);
  }
  return semQuery;
}

export function casaRota(
  esperada: string | undefined,
  pathname: string,
): boolean {
  if (!esperada) return true;
  return normalizarRota(esperada) === normalizarRota(pathname);
}
