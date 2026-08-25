import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const POLL_MS = 5000;

export function useWaiterCollaborators(orgSlug: string) {
  return useQuery(
    orpc.kitchen.publicCollaborators.queryOptions({ input: { orgSlug } }),
  );
}

export function useWaiterProducts(orgSlug: string) {
  return useQuery(
    orpc.kitchen.publicProducts.queryOptions({ input: { orgSlug } }),
  );
}

export function useWaiterOrders(orgSlug: string, attendantId: string | null) {
  return useQuery(
    orpc.kitchen.publicListForAttendant.queryOptions({
      input: { orgSlug, attendantId: attendantId ?? "" },
      enabled: Boolean(attendantId),
      refetchInterval: POLL_MS,
    }),
  );
}

export function useWaiterCreateOrder(
  orgSlug: string,
  attendantId: string | null,
) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.kitchen.publicCreate.mutationOptions({
      onSuccess: ({ count }) => {
        toast.success(
          count > 1 ? `${count} pedidos registrados!` : "Pedido registrado!",
        );
        queryClient.invalidateQueries({
          queryKey: orpc.kitchen.publicListForAttendant.queryKey({
            input: { orgSlug, attendantId: attendantId ?? "" },
          }),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
}

export function useWaiterDeliverOrder(
  orgSlug: string,
  attendantId: string | null,
) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.kitchen.publicDeliver.mutationOptions({
      onSuccess: () => {
        toast.success("Pedido entregue!");
        queryClient.invalidateQueries({
          queryKey: orpc.kitchen.publicListForAttendant.queryKey({
            input: { orgSlug, attendantId: attendantId ?? "" },
          }),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
}
