/**
 * DTOs do pull incremental (server → device).
 *
 * Dados de referência (catálogo, preços, clientes, snapshot de estoque) descem
 * por cursor `updatedSince`, não pull completo. Usado a partir da Fase 2.
 */

export type PullCursor = {
  /** ISO da última sincronização bem-sucedida daquele recurso. */
  updatedSince: string | null;
  limit?: number;
};

export type PullPage<T> = {
  items: T[];
  /** Novo watermark para a próxima página/sync. null = fim. */
  nextUpdatedSince: string | null;
};
