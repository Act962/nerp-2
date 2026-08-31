"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export function useEtiquetas(funnelId: string | null, habilitado = true) {
  return useQuery(
    orpc.crm.tag.list.queryOptions({
      input: { funnelId: funnelId ?? undefined },
      enabled: habilitado,
      staleTime: 60_000,
    }),
  );
}

export function useCriarEtiqueta() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.crm.tag.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.crm.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useEtiquetarLead() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.crm.lead.setTags.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.crm.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useMotivos(funnelId: string | null, habilitado = true) {
  return useQuery(
    orpc.crm.motivo.list.queryOptions({
      input: { funnelId: funnelId ?? "" },
      enabled: habilitado && Boolean(funnelId),
      staleTime: 5 * 60_000,
    }),
  );
}

export function useCriarMotivo() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.crm.motivo.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.crm.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useEncerrarLead() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.crm.lead.close.mutationOptions({
      onSuccess: (resultado) => {
        toast.success(
          resultado.resultado === "WON"
            ? "Contato marcado como ganho"
            : resultado.resultado === "LOST"
              ? "Contato marcado como perdido"
              : "Contato reaberto",
        );
        queryClient.invalidateQueries({ queryKey: orpc.crm.key() });
        queryClient.invalidateQueries({ queryKey: orpc.conversation.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
