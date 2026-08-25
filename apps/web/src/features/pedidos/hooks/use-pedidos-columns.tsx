import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type KitchenColumn = {
  id: string;
  name: string;
  color: string;
  position: number;
  wipLimit: number | null;
  isActive: boolean;
  description: string | null;
  icon: string | null;
  isInitial: boolean;
  showOnTv: boolean;
  isFinal: boolean;
};

// Mexer em colunas afeta o agrupamento dos pedidos, então invalidamos as duas chaves.
function invalidateColumnsAndOrders(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.invalidateQueries({ queryKey: orpc.kitchen.columns.list.key() });
  queryClient.invalidateQueries({ queryKey: orpc.kitchen.list.key() });
}

export function useQueryKitchenColumns(includeInactive = false) {
  return useQuery(
    orpc.kitchen.columns.list.queryOptions({ input: { includeInactive } }),
  );
}

export function useMutationCreateColumn() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.kitchen.columns.create.mutationOptions({
      onSuccess: () => {
        toast.success("Coluna criada com sucesso!");
        invalidateColumnsAndOrders(queryClient);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
}

export function useMutationUpdateColumn() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.kitchen.columns.update.mutationOptions({
      onSuccess: () => {
        toast.success("Coluna atualizada!");
        invalidateColumnsAndOrders(queryClient);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
}

export function useMutationDeleteColumn() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.kitchen.columns.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Coluna apagada!");
        invalidateColumnsAndOrders(queryClient);
      },
      // BAD_REQUEST: coluna com cards ou única coluna de entrada.
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
}

export function useMutationReorderColumns() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.kitchen.columns.reorder.mutationOptions({
      onSuccess: () => {
        invalidateColumnsAndOrders(queryClient);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
}
