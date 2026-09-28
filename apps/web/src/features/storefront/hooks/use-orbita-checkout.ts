import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

const ORBITA_STATUS_POLL_MS = 3_000;

export function useOrbitaCheckout() {
  return useMutation(
    orpc.checkout.orbitaCheckout.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}

/**
 * Consulta os links do pedido enquanto o Órbita não responde. Para sozinho
 * quando o `portalUrl` chega ou quando quem chama desliga (`enabled`).
 */
export function useOrbitaOrderStatus({
  subdomain,
  saleId,
  enabled,
}: {
  subdomain: string;
  saleId: string;
  enabled: boolean;
}) {
  return useQuery(
    orpc.checkout.orbitaStatus.queryOptions({
      input: { subdomain, saleId },
      enabled: enabled && Boolean(subdomain) && Boolean(saleId),
      refetchInterval: (query) =>
        query.state.data?.portalUrl ? false : ORBITA_STATUS_POLL_MS,
      retry: false,
    }),
  );
}
