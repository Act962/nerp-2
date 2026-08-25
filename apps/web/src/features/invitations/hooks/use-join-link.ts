"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

/** Links abertos de entrada da organização (admin). */
export function useJoinLinks() {
  return useQuery(orpc.invitation.joinLink.list.queryOptions({ input: {} }));
}

function useInvalidateJoinLinks() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: orpc.invitation.joinLink.list.key() });
}

export function useSaveJoinLink() {
  const invalidate = useInvalidateJoinLinks();
  return useMutation(
    orpc.invitation.joinLink.save.mutationOptions({
      onSuccess: () => {
        toast.success("Link salvo!");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRegenerateJoinLink() {
  const invalidate = useInvalidateJoinLinks();
  return useMutation(
    orpc.invitation.joinLink.regenerate.mutationOptions({
      onSuccess: () => {
        toast.success("Novo link gerado. O anterior deixou de valer.");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteJoinLink() {
  const invalidate = useInvalidateJoinLinks();
  return useMutation(
    orpc.invitation.joinLink.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Link excluído.");
        invalidate();
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
