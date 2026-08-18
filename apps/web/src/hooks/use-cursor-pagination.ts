import { useCallback, useState } from "react";

/**
 * Gerencia paginação baseada em cursor mantendo uma pilha dos cursores já
 * visitados. A primeira página não tem cursor (`undefined`).
 *
 * - `cursor`: cursor da página atual (passe para a query).
 * - `pageIndex`: índice 1-based da página atual.
 * - `hasPrevious`: há página anterior para voltar.
 * - `goNext(nextCursor)`: avança usando o cursor retornado pela query.
 * - `goPrevious()`: volta uma página.
 * - `reset()`: volta para a primeira página (use ao trocar filtros).
 */
export function useCursorPagination() {
  const [stack, setStack] = useState<(string | undefined)[]>([undefined]);

  const cursor = stack[stack.length - 1];
  const pageIndex = stack.length;
  const hasPrevious = stack.length > 1;

  const goNext = useCallback((nextCursor: string | null | undefined) => {
    if (!nextCursor) return;
    setStack((prev) => [...prev, nextCursor]);
  }, []);

  const goPrevious = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const reset = useCallback(() => setStack([undefined]), []);

  return { cursor, pageIndex, hasPrevious, goNext, goPrevious, reset };
}
