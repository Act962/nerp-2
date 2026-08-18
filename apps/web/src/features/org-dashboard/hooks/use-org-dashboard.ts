"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Hooks do dashboard da organização. Compactos porque cada endpoint só é
// chamado por 1-2 componentes — não precisa de wrapper por procedure.

const POLL_INTERVAL_MS = 5 * 60_000; // mesmo do dashboard pessoal
// Enquanto algum widget Oracle ainda não tem snapshot, a resolução devolve
// este marcador e o cálculo roda em background. Poll rápido até o valor chegar
// — sem isso um widget Oracle recém-adicionado ficaria "Calculando…" por até 5
// min. Bate com o literal em `_oracle-custom.ts` e com o hook pessoal.
const CALCULATING_MARKER = "Calculando…";
const CALCULATING_POLL_INTERVAL_MS = 5_000;

export function useOrgDashboard() {
  return useQuery(orpc.orgDashboard.get.queryOptions({ input: {} }));
}

export function useOrgDashboardAdmin() {
  return useQuery(orpc.orgDashboard.getForAdmin.queryOptions({ input: {} }));
}

export function useOrgDashboardValues(widgetIds?: string[]) {
  return useQuery(
    orpc.orgDashboard.resolveValues.queryOptions({
      input: { widgetIds },
      refetchInterval: (query) => {
        const values = query.state.data?.values ?? [];
        const anyCalculating = values.some(
          (entry) => entry.error === CALCULATING_MARKER,
        );
        return anyCalculating ? CALCULATING_POLL_INTERVAL_MS : POLL_INTERVAL_MS;
      },
    }),
  );
}

/** Invalida tanto a lista quanto o admin — só precisa de uma chave raiz. */
function useInvalidateOrgDashboard() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.orgDashboard.key() });
}

export function useAddOrgWidget() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.addWidget.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateOrgWidget() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.updateWidget.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Widget salvo.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRemoveOrgWidget() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.removeWidget.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSetMemberPermissions() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.setMemberPermissions.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Permissões salvas.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRotateOrgShareToken() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.rotateShareToken.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useAddOrgPanel() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.addPanel.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Painel criado.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateOrgPanel() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.updatePanel.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRemoveOrgPanel() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.removePanel.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSaveOrgLayout() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.saveLayout.mutationOptions({
      // Sem toast/refetch por save: o layout já está na tela (otimista via
      // RGL). Só reconcilia a lista silenciosamente.
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSaveOrgPanelLayout() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.savePanelLayout.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useReorderOrgPanels() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.reorderPanels.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useReorderOrgWidgets() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.reorderWidgets.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useOrgPanelTemplates() {
  return useQuery(
    orpc.orgDashboard.listPanelTemplates.queryOptions({ input: {} }),
  );
}

export function useUpdateOrgPublicSettings() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.updatePublicSettings.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Configurações do link público salvas.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// -------- Boards (quadros) --------

export function useAddOrgBoard() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.addBoard.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Quadro criado.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateOrgBoard() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.updateBoard.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRemoveOrgBoard() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.removeBoard.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useReorderOrgBoards() {
  const invalidate = useInvalidateOrgDashboard();
  return useMutation(
    orpc.orgDashboard.reorderBoards.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}
