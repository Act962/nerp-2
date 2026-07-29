"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export function useMyDashboardWidgets() {
  return useQuery(orpc.dashboardWidgets.listMine.queryOptions({ input: {} }));
}

// 5 minutos, não 60s: widgets de consulta ao Oracle leem de um snapshot que é
// recalculado nessa cadência, e o resto (vendas/estoque nativos) não muda a
// ponto de justificar poll de 1 minuto. Quem quiser o número agora usa o botão
// de atualizar no widget.
export const WIDGET_POLL_INTERVAL_MS = 5 * 60_000;

export function useDashboardWidgetValues(widgetIds?: string[]) {
  return useQuery(
    orpc.dashboardWidgets.resolveValues.queryOptions({
      input: { widgetIds },
      refetchInterval: WIDGET_POLL_INTERVAL_MS,
    }),
  );
}

// Registros por trás do número. Diferente do resto, ESTA consulta bate no
// Oracle a cada página — por isso só roda com o popup aberto (`enabled`).
export function useOracleDrilldown(
  widgetId: string | null,
  page: number,
  pageSize: number,
) {
  return useQuery(
    orpc.dashboardWidgets.drilldown.queryOptions({
      input: { widgetId: widgetId ?? "", page, pageSize },
      enabled: Boolean(widgetId),
      // Paginar não deve piscar a tabela inteira a cada troca de página.
      placeholderData: (previous) => previous,
    }),
  );
}

// Força o recálculo da consulta contra o Oracle. Diferente do resto, ESPERA o
// resultado — é ação explícita do usuário, que quer ver o número novo.
export function useRefreshOracleWidget() {
  const qc = useQueryClient();
  return useMutation(
    orpc.dashboardWidgets.refreshOracle.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: orpc.dashboardWidgets.resolveValues.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useAddDashboardWidget() {
  const qc = useQueryClient();
  return useMutation(
    orpc.dashboardWidgets.add.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.dashboardWidgets.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateDashboardWidget() {
  const qc = useQueryClient();
  return useMutation(
    orpc.dashboardWidgets.update.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.dashboardWidgets.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRemoveDashboardWidget() {
  const qc = useQueryClient();
  return useMutation(
    orpc.dashboardWidgets.remove.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.dashboardWidgets.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Sem toast de sucesso nem invalidação agressiva — chamado com debounce a
// cada arraste/resize; recarregar tudo a cada save daria uma piscada na tela
// bem irritante. O client já está com o estado otimista correto.
export function useSaveDashboardLayout() {
  return useMutation(
    orpc.dashboardWidgets.saveLayout.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}
