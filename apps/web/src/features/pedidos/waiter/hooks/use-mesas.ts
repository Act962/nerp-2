"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Mesmo ritmo do resto do KDS. A grade precisa acompanhar o salão, mas o
// garçom está olhando para o cliente, não para a tela.
const POLL_MS = 5000;

export type MesaDoSalao = {
  id: string;
  number: number;
  name: string | null;
  seats: number | null;
  qrToken: string;
  isActive: boolean;
  estado: "LIVRE" | "CONSUMINDO" | "FECHANDO";
  total: number;
  itens: number;
  abertaDesde: string | null;
  atendente: string | null;
};

export function useMesasDoGarcom(orgSlug: string) {
  return useQuery(
    orpc.mesa.listForWaiter.queryOptions({
      input: { orgSlug },
      refetchInterval: POLL_MS,
    }),
  );
}

function useInvalidarMesas() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.mesa.listForWaiter.key() });
    queryClient.invalidateQueries({ queryKey: orpc.mesa.list.key() });
  };
}

export function usePedirConta() {
  const invalidar = useInvalidarMesas();
  return useMutation(
    orpc.mesa.requestBill.mutationOptions({
      onSuccess: () => {
        toast.success("Conta pedida. A mesa aparece como fechando.");
        invalidar();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useLiberarMesa() {
  const invalidar = useInvalidarMesas();
  return useMutation(
    orpc.mesa.release.mutationOptions({
      onSuccess: ({ arquivados }) => {
        toast.success(
          arquivados > 0
            ? `Mesa liberada. ${arquivados} ${arquivados === 1 ? "pedido saiu" : "pedidos saíram"} da cozinha.`
            : "Mesa liberada.",
        );
        invalidar();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useResolverQrDaMesa() {
  return useMutation(
    orpc.mesa.resolveQr.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}
