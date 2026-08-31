"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

/** Estado da conexão do funil. `enabled` só quando há funil selecionado. */
export function useWhatsAppConnection(funnelId: string | null) {
  return useQuery(
    orpc.whatsapp.connection.get.queryOptions({
      input: { funnelId: funnelId ?? "" },
      enabled: Boolean(funnelId),
    }),
  );
}

export function useSaveWhatsAppConnection() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.whatsapp.connection.save.mutationOptions({
      onSuccess: () => {
        toast.success("Número conectado");
        queryClient.invalidateQueries({ queryKey: orpc.whatsapp.key() });
        // A lista de funis mostra o status do número em cada cartão.
        queryClient.invalidateQueries({ queryKey: orpc.crm.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/**
 * Testa a credencial contra a Meta. Não usa `toast.success` cego: o
 * procedimento devolve `ok: false` com o motivo quando a credencial é válida
 * mas aponta para outra conta — dizer "sucesso" ali seria mentira.
 */
export function useTestWhatsAppConnection() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.whatsapp.connection.test.mutationOptions({
      onSuccess: (resultado) => {
        if (resultado.ok) toast.success("Conexão funcionando");
        else toast.error(resultado.erro ?? "Não foi possível validar");
        queryClient.invalidateQueries({ queryKey: orpc.whatsapp.key() });
        queryClient.invalidateQueries({ queryKey: orpc.crm.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRemoveWhatsAppConnection() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.whatsapp.connection.remove.mutationOptions({
      onSuccess: () => {
        toast.success("Número desconectado");
        queryClient.invalidateQueries({ queryKey: orpc.whatsapp.key() });
        queryClient.invalidateQueries({ queryKey: orpc.crm.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
