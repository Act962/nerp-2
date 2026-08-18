"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Caixa: cria a solicitação de cancelamento/redução (gera o token do QR).
export function useCreateCancelRequest() {
  return useMutation(
    orpc.cancelRequest.create.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Caixa: autoriza pela tela do PDV digitando o PIN pessoal do supervisor.
export function useAuthorizeCancelByPin() {
  return useMutation(
    orpc.cancelRequest.authorizePin.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Caixa: poll do status enquanto o QR está na tela.
export function useCancelRequestStatus(id: string | null, enabled: boolean) {
  return useQuery(
    orpc.cancelRequest.get.queryOptions({
      input: { id: id ?? "" },
      enabled: enabled && !!id,
      refetchInterval: (query) =>
        query.state.data?.status === "PENDING" ? 1500 : false,
    }),
  );
}

// Celular do supervisor: detalhes da solicitação pelo token.
export function useCancelRequestByToken(token: string) {
  return useQuery(
    orpc.cancelRequest.getByToken.queryOptions({
      input: { token },
      refetchInterval: (query) =>
        query.state.data?.status === "PENDING" ? 2000 : false,
    }),
  );
}

// Celular do supervisor: aprova pelo QR.
export function useAuthorizeCancelByToken() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.cancelRequest.authorizeToken.mutationOptions({
      onSuccess: () => {
        toast.success("Cancelamento autorizado");
        queryClient.invalidateQueries({
          queryKey: orpc.cancelRequest.getByToken.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Celular do supervisor: recusa a solicitação.
export function useRejectCancelRequest() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.cancelRequest.reject.mutationOptions({
      onSuccess: () => {
        toast.success("Solicitação recusada");
        queryClient.invalidateQueries({
          queryKey: orpc.cancelRequest.getByToken.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Configurações: liga/desliga a exigência por organização.
export function useUpdateRequireCancelAuth() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.org.updateRequireCancelAuth.mutationOptions({
      onSuccess: () => {
        toast.success("Configuração salva");
        queryClient.invalidateQueries({ queryKey: orpc.org.get.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Configurações: o autorizador define/limpa o próprio PIN.
export function useSetCancelPin() {
  return useMutation(
    orpc.members.setCancelPin.mutationOptions({
      onSuccess: () => toast.success("PIN atualizado"),
      onError: (error) => toast.error(error.message),
    }),
  );
}
