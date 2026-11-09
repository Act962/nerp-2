"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useFiscalConfig() {
  const query = useQuery(orpc.fiscalConfig.get.queryOptions({ input: {} }));
  return { config: query.data, isLoading: query.isPending };
}

export function useSaveFiscalConfig() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.fiscalConfig.upsert.mutationOptions({
      onSuccess: () => {
        toast.success("Configuração fiscal salva");
        // Regime e padrões mudam o que o cadastro de produto aceita e o que a
        // tela de prontidão considera pronto.
        queryClient.invalidateQueries({ queryKey: orpc.fiscalConfig.key() });
        queryClient.invalidateQueries({
          queryKey: orpc.products.fiscalReadiness.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/**
 * Envia o .pfx + senha. Diferente do `upsert`, esta mutation grava sozinha
 * (arquivo, validade e senha cifrada), então invalida a config no sucesso.
 */
export function useUploadCertificate() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.fiscalConfig.uploadCertificate.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `Certificado de ${data.subjectName} válido até ${new Date(
            data.expiresAt,
          ).toLocaleDateString("pt-BR")}`,
        );
        queryClient.invalidateQueries({
          queryKey: orpc.fiscalConfig.get.key(),
        });
      },
      onError: (error) => toast.error(error.message, { duration: 8000 }),
    }),
  );
}

export function useTestSefaz() {
  return useMutation(
    orpc.fiscalConfig.testSefaz.mutationOptions({
      onSuccess: (data) => {
        if (data.ok)
          toast.success(
            `SEFAZ PI respondeu (${data.status}, ${data.latencyMs}ms)`,
          );
        else
          toast.error(
            data.message ??
              `SEFAZ PI: sem resposta (${data.status || "timeout"})`,
            { duration: 8000 },
          );
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSyncFocus() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.fiscalConfig.syncFocus.mutationOptions({
      onSuccess: (data) => {
        const tokens = data.recebeuTokenHomologacao
          ? "tokens gravados"
          : "a Focus não devolveu o token de homologação — cole-o abaixo";
        toast.success(
          `Empresa ${data.criada ? "cadastrada" : "atualizada"} na Focus (ID ${data.empresaId}); ${tokens}`,
          { duration: 8000 },
        );
        queryClient.invalidateQueries({
          queryKey: orpc.fiscalConfig.get.key(),
        });
      },
      onError: (error) => toast.error(error.message, { duration: 10000 }),
    }),
  );
}

export function useTestProvider() {
  return useMutation(
    orpc.fiscalConfig.testProvider.mutationOptions({
      onSuccess: (data) => {
        if (data.ok)
          toast.success(
            `Focus NFe respondeu (${data.status}, ${data.latencyMs}ms)`,
          );
        else toast.error(data.message ?? "Falha ao chamar o provedor");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
