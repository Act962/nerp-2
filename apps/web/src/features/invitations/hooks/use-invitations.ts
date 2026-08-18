"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useInvitations(status: "pending" | "all" = "pending") {
  const { data, isPending } = useQuery(
    orpc.invitation.list.queryOptions({ input: { status } }),
  );
  return { invitations: data ?? [], isLoading: isPending };
}

export function useInvitation(id: string) {
  const { data, isPending, error } = useQuery({
    ...orpc.invitation.get.queryOptions({ input: { id } }),
    enabled: !!id,
    retry: false,
  });
  return { invitation: data ?? null, isLoading: isPending, error };
}

function useInvalidateInvitations() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.invitation.list.key() });
  };
}

export function useCreateInvitation() {
  const invalidate = useInvalidateInvitations();
  return useMutation(
    orpc.invitation.create.mutationOptions({
      // O lote é parcial por natureza: reporta os dois lados em vez de
      // declarar sucesso quando parte falhou.
      onSuccess: ({ sent, failed }) => {
        if (sent.length) {
          toast.success(
            sent.length === 1
              ? `Convite enviado para ${sent[0]}`
              : `${sent.length} convites enviados`,
          );
        }
        for (const { email, reason } of failed) {
          toast.error(`${email}: ${reason}`);
        }
        invalidate();
      },
      onError: (error) => {
        toast.error(error.message);
        invalidate();
      },
    }),
  );
}

export function useCancelInvitation() {
  const invalidate = useInvalidateInvitations();
  return useMutation(
    orpc.invitation.cancel.mutationOptions({
      onSuccess: () => {
        toast.success("Convite cancelado.");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useResendInvitation() {
  const invalidate = useInvalidateInvitations();
  return useMutation(
    orpc.invitation.resend.mutationOptions({
      onSuccess: () => {
        toast.success("Convite reenviado!");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useAcceptInvitation() {
  return useMutation(
    orpc.invitation.accept.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRejectInvitation() {
  return useMutation(
    orpc.invitation.reject.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}
