import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Fila de pedidos do catálogo aguardando aprovação no PDV.
// Poll de 15s garante que o "X novos pedidos" no header reflete a fila
// mesmo sem realtime (o PDV fica aberto o tempo todo, então tudo bem).
export function usePendingCatalogOrders() {
  return useQuery(
    orpc.sales.listPendingApproval.queryOptions({
      input: {},
      refetchInterval: 15000,
      refetchIntervalInBackground: false,
    }),
  );
}

// Aprova um pedido pendente:
//   - Fecha a Sale pendente (backend marca como CANCELLED com nota).
//   - Devolve os itens pra o PDV hidratar o carrinho.
// A hidratação do carrinho fica a cargo do caller (dispara `setHydratePayload`
// no store da UI e o create-sale escuta e popula o form).
export function useApprovePending() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.sales.approvePending.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.sales.listPendingApproval.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
