"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

/** Link aberto de entrada da organização (admin). */
export function useJoinLink() {
  return useQuery(orpc.invitation.joinLink.get.queryOptions({ input: {} }));
}

export function useRotateJoinLink() {
  const qc = useQueryClient();
  return useMutation(
    orpc.invitation.joinLink.rotate.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.link ? "Link gerado!" : "Link desativado.");
        qc.invalidateQueries({ queryKey: orpc.invitation.joinLink.get.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/** Prévia pública do convite — usada na página de entrada, sem login. */
export function useJoinLinkPreview(token: string) {
  return useQuery({
    ...orpc.invitation.joinLink.preview.queryOptions({ input: { token } }),
    // Token inválido é 404 definitivo; retentar só atrasa a mensagem.
    retry: false,
  });
}

export function useAcceptJoinLink() {
  return useMutation(
    orpc.invitation.joinLink.accept.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}
