"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/**
 * Metas do período, para as colunas Vl.meta/%Meta dos widgets de tabela.
 *
 * Somente leitura de propósito: a meta é cadastrada no módulo de Ranking
 * (importação de planilha), e este hook lê a projeção daquela mesma fonte —
 * não existe um segundo lugar onde editar meta.
 */
export function useSalesGoals(year?: number) {
  return useQuery(
    orpc.dashboardWidgets.salesGoals.list.queryOptions({ input: { year } }),
  );
}
