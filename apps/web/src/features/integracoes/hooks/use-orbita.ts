"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

/**
 * Estado da conexão com o Órbita.
 *
 * `aguardando` liga uma sondagem curta: a autorização acontece **na aba do
 * Órbita**, e é lá que ela termina — o `returnUrl` de lá é relativo ao próprio
 * Órbita e não volta para cá. Sem sondar, o operador voltaria para esta aba e
 * veria "desconectado" mesmo tendo autorizado.
 */
export function useOrbitaStatus(aguardando = false) {
  return useQuery(
    orpc.integracoes.orbita.status.queryOptions({
      input: {},
      refetchInterval: aguardando ? 3000 : false,
      // Enquanto espera, também recarrega ao voltar para a aba — costuma
      // acertar antes da próxima sondagem.
      refetchOnWindowFocus: aguardando,
    }),
  );
}

export function useRevogarOrbita() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.integracoes.orbita.revoke.mutationOptions({
      onSuccess: (resultado) => {
        toast.success(
          resultado.revogadas > 0
            ? "Acesso do Órbita revogado"
            : "Não havia acesso ativo",
        );
        queryClient.invalidateQueries({ queryKey: orpc.integracoes.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
