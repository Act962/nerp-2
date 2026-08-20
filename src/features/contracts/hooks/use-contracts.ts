import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useContracts() {
  return useQuery(
    orpc.spaceNegotiation.listContracts.queryOptions({ input: {} }),
  );
}

function useInvalidateContracts() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.spaceNegotiation.listContracts.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.financeiro.entries.list.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.financeiro.dashboard.get.key(),
    });
  };
}

export function useCancelContract() {
  const invalidate = useInvalidateContracts();
  return useMutation(
    orpc.spaceNegotiation.cancelContract.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `Contrato cancelado — ${data.entriesCancelled} recebível(is) cancelado(s)`,
        );
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useExpireContracts() {
  const invalidate = useInvalidateContracts();
  return useMutation(
    orpc.spaceNegotiation.expireContracts.mutationOptions({
      onSuccess: (data) => {
        toast.success(`${data.expired} contrato(s) marcados como expirados`);
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
