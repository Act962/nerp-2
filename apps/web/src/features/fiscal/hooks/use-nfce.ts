"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const EM_ANDAMENTO = new Set(["PENDING", "PROCESSING"]);

/** A empresa consegue emitir agora? Decide se o PDV oferece a NFC-e. */
export function useSituacaoFiscal() {
  return useQuery(
    orpc.fiscal.situacao.queryOptions({
      input: {},
      staleTime: 60_000,
    }),
  );
}

/**
 * Documento fiscal da venda. Consulta a cada 2 s enquanto a SEFAZ não decide
 * e para sozinho quando autoriza, rejeita ou cancela.
 */
export function useNfceDaVenda(saleId: string | null) {
  return useQuery(
    orpc.fiscal.daVenda.queryOptions({
      input: { saleId: saleId ?? "" },
      enabled: !!saleId,
      refetchInterval: (query) =>
        query.state.data && EM_ANDAMENTO.has(query.state.data.status)
          ? 2_000
          : false,
    }),
  );
}

/** Toda mudança de nota reflete no PDV, na tela de notas e nos alertas. */
function useAtualizarDocumento() {
  const queryClient = useQueryClient();
  return (saleId: string) => {
    queryClient.invalidateQueries({
      queryKey: orpc.fiscal.daVenda.key({ input: { saleId } }),
    });
    queryClient.invalidateQueries({ queryKey: orpc.fiscal.listar.key() });
    queryClient.invalidateQueries({ queryKey: orpc.fiscal.numeracao.key() });
    queryClient.invalidateQueries({ queryKey: orpc.fiscal.alertas.key() });
  };
}

export function useEmitirNfce() {
  const atualizar = useAtualizarDocumento();
  return useMutation(
    orpc.fiscal.emitirNfce.mutationOptions({
      onSuccess: (doc) => atualizar(doc.saleId),
      onError: (error) => toast.error(error.message, { duration: 10_000 }),
    }),
  );
}

export function useTentarNfceNovamente() {
  const atualizar = useAtualizarDocumento();
  return useMutation(
    orpc.fiscal.tentarNovamente.mutationOptions({
      onSuccess: (doc) => atualizar(doc.saleId),
      onError: (error) => toast.error(error.message, { duration: 10_000 }),
    }),
  );
}

export function useReenviarNfce() {
  const atualizar = useAtualizarDocumento();
  return useMutation(
    orpc.fiscal.reenviar.mutationOptions({
      onSuccess: (doc) => atualizar(doc.saleId),
      onError: (error) => toast.error(error.message, { duration: 10_000 }),
    }),
  );
}

export function useCancelarNfce() {
  const atualizar = useAtualizarDocumento();
  return useMutation(
    orpc.fiscal.cancelar.mutationOptions({
      onSuccess: (doc) => {
        toast.success(`NFC-e nº ${doc.numero} cancelada`);
        atualizar(doc.saleId);
      },
      onError: (error) => toast.error(error.message, { duration: 10_000 }),
    }),
  );
}
