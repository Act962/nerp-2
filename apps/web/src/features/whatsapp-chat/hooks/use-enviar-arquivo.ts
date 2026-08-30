"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

/**
 * Envia arquivo pela rota `multipart`, não pelo oRPC.
 *
 * O oRPC transporta JSON: um vídeo de 16 MB viraria 21 MB de base64. Aqui os
 * bytes vão como bytes, e o hook mantém a mesma cara dos outros do módulo —
 * toast no erro, invalidação no sucesso.
 */
export function useEnviarArquivo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entrada: {
      conversationId: string;
      arquivo: File;
      legenda?: string;
    }) => {
      const corpo = new FormData();
      corpo.append("conversationId", entrada.conversationId);
      corpo.append("arquivo", entrada.arquivo);
      if (entrada.legenda) corpo.append("legenda", entrada.legenda);

      const resposta = await fetch("/api/whatsapp/media/enviar", {
        method: "POST",
        body: corpo,
      });

      if (!resposta.ok) {
        const detalhe = await resposta
          .json()
          .catch(() => ({ erro: "Falha ao enviar o arquivo" }));
        throw new Error(detalhe.erro ?? "Falha ao enviar o arquivo");
      }

      return (await resposta.json()) as { id: string; createdAt: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.message.key() });
      queryClient.invalidateQueries({ queryKey: orpc.conversation.key() });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });
}
