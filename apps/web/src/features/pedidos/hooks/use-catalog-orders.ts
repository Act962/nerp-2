import type { kitchenRoutes } from "@/app/router/pedidos";
import type { CatalogStatusGroup } from "@/features/pedidos/utils/catalog-order-status";
import { orpc } from "@/lib/orpc";
import type { InferRouterOutputs } from "@orpc/server";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Mesmo intervalo da fila de pendentes do PDV: sem realtime, o poll é o que
// faz um pedido novo aparecer sozinho.
const POLL_MS = 15000;

type Outputs = InferRouterOutputs<typeof kitchenRoutes>;
export type CatalogOrder = Outputs["catalogOrders"]["list"]["orders"][number];

export function useCatalogOrders(params: {
  status: CatalogStatusGroup;
  cursor?: string;
}) {
  return useQuery(
    orpc.kitchen.catalogOrders.list.queryOptions({
      input: { status: params.status, cursor: params.cursor },
      refetchInterval: POLL_MS,
      refetchIntervalInBackground: false,
    }),
  );
}

function useInvalidateCatalogOrders() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.kitchen.catalogOrders.list.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.sales.listPendingApproval.key(),
    });
  };
}

export function useRejectCatalogOrder() {
  const invalidate = useInvalidateCatalogOrders();
  return useMutation(
    orpc.kitchen.catalogOrders.reject.mutationOptions({
      onSuccess: () => {
        toast.success("Pedido recusado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/**
 * "Abrir no PDV": o mesmo `approvePending` do diálogo do PDV. Devolve itens e
 * cliente para o componente hidratar o carrinho antes de navegar.
 */
export function useOpenCatalogOrderInPdv() {
  const invalidate = useInvalidateCatalogOrders();
  return useMutation(
    orpc.sales.approvePending.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => toast.error(error.message),
    }),
  );
}
