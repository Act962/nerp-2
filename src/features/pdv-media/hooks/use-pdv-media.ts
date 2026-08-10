"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Mídias ativas + config, para o painel do PDV. `enabled` evita a chamada RPC
// nas demais rotas (o painel vive no layout, montado em todas as páginas).
export function usePdvMediaPanel(enabled = true) {
  const query = useQuery(
    orpc.pdvMedia.panel.queryOptions({ input: {}, enabled }),
  );
  return {
    medias: query.data?.medias ?? [],
    settings: query.data?.settings ?? { enabled: false, pauseSeconds: 1 },
    isLoading: query.isPending,
  };
}

// Todas as mídias + config, para a tela de gestão.
export function usePdvMediaList() {
  const query = useQuery(orpc.pdvMedia.list.queryOptions({ input: {} }));
  return {
    medias: query.data?.medias ?? [],
    settings: query.data?.settings ?? { enabled: false, pauseSeconds: 1 },
    isLoading: query.isPending,
  };
}

function useInvalidatePdvMedia() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.pdvMedia.list.key() });
    queryClient.invalidateQueries({ queryKey: orpc.pdvMedia.panel.key() });
  };
}

export function useCreatePdvMedia() {
  const invalidate = useInvalidatePdvMedia();
  return useMutation(
    orpc.pdvMedia.create.mutationOptions({
      onSuccess: () => {
        toast.success("Mídia adicionada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdatePdvMedia() {
  const invalidate = useInvalidatePdvMedia();
  return useMutation(
    orpc.pdvMedia.update.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeletePdvMedia() {
  const invalidate = useInvalidatePdvMedia();
  return useMutation(
    orpc.pdvMedia.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Mídia removida");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useReorderPdvMedia() {
  const invalidate = useInvalidatePdvMedia();
  return useMutation(
    orpc.pdvMedia.reorder.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdatePdvMediaSettings() {
  const invalidate = useInvalidatePdvMedia();
  return useMutation(
    orpc.pdvMedia.updateSettings.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}
