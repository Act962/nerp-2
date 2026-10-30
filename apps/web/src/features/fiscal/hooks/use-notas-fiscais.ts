"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export type FiltrosNotas = {
  status?:
    | "PENDING"
    | "PROCESSING"
    | "AUTHORIZED"
    | "REJECTED"
    | "CANCELLED"
    | "DENIED"
    | "VOIDED"
    | "CONTINGENCY";
  de?: string;
  ate?: string;
  numero?: number;
  cursor?: string;
};

export function useNotasFiscais(filtros: FiltrosNotas) {
  return useQuery(
    orpc.fiscal.listar.queryOptions({
      input: filtros,
      placeholderData: (anterior) => anterior,
    }),
  );
}

export function useNumeracaoFiscal() {
  return useQuery(orpc.fiscal.numeracao.queryOptions({ input: {} }));
}

export function useAlertasFiscais() {
  return useQuery(
    orpc.fiscal.alertas.queryOptions({ input: {}, staleTime: 60_000 }),
  );
}

export function useInutilizarNumeracao() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.fiscal.inutilizar.mutationOptions({
      onSuccess: (r) => {
        toast.success(`Números inutilizados — protocolo ${r.protocolo}`);
        queryClient.invalidateQueries({
          queryKey: orpc.fiscal.numeracao.key(),
        });
        queryClient.invalidateQueries({ queryKey: orpc.fiscal.listar.key() });
        queryClient.invalidateQueries({ queryKey: orpc.fiscal.alertas.key() });
      },
      onError: (error) => toast.error(error.message, { duration: 10_000 }),
    }),
  );
}
