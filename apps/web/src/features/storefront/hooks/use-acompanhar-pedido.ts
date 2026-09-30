import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

const TERMINADOS = ["COMPLETED", "CANCELLED"];

/**
 * O pedido que o cliente está acompanhando. Enquanto ele anda, a tela se
 * atualiza sozinha; concluído ou cancelado, para de perguntar.
 */
export function useAcompanharPedido(subdomain: string, saleId: string) {
  return useQuery(
    orpc.checkout.orderTracking.queryOptions({
      input: { subdomain, saleId },
      enabled: !!subdomain && !!saleId,
      retry: 1,
      refetchInterval: (query) =>
        TERMINADOS.includes(query.state.data?.status ?? "") ? false : 15_000,
    }),
  );
}
