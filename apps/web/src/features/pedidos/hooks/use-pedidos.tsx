import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const POLL_MS = 5000;

export type KitchenOrder = {
  id: string;
  columnId: string;
  tableNumber: string;
  dishName: string;
  notes: string | null;
  estimatedMinutes: number | null;
  // Itens do mesmo pedido compartilham o ticket. Null = pedido anterior ao
  // ticket; a UI agrupa por `ticketId ?? id`, então ele vira ticket de um item.
  ticketId: string | null;
  position: number;
  attendantId: string | null;
  attendantName: string | null;
  attendantPhoto: string | null;
  createdByName: string | null;
  createdAt: string;
  columnEnteredAt: string;
  archivedAt: string | null;
};

// Uma query só com todos os pedidos ativos; o board agrupa por columnId no cliente.
const ordersInput = {} as const;
const ordersQueryKey = orpc.kitchen.list.queryKey({ input: ordersInput });

export function useQueryKitchenOrders() {
  return useQuery(
    orpc.kitchen.list.queryOptions({
      input: ordersInput,
      refetchInterval: POLL_MS, // polling: substitui websockets
    }),
  );
}

// Pedidos arquivados (finalizados fora do board), p/ a área de arquivados.
export function useQueryArchivedKitchenOrders() {
  return useQuery(
    orpc.kitchen.list.queryOptions({
      input: { archived: true },
      refetchInterval: POLL_MS,
    }),
  );
}

export function useMutationSetArchivedKitchenOrder() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.kitchen.setArchived.mutationOptions({
      // Update otimista: arquivar tira o card do board na hora; restaurar idem.
      onMutate: async ({ id, archived }) => {
        await queryClient.cancelQueries({ queryKey: ordersQueryKey });
        const previous =
          queryClient.getQueryData<KitchenOrder[]>(ordersQueryKey);

        if (archived) {
          queryClient.setQueryData<KitchenOrder[]>(ordersQueryKey, (old) =>
            old?.filter((order) => order.id !== id),
          );
        }

        return { previous };
      },
      onError: (error, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(ordersQueryKey, context.previous);
        }
        toast.error(error.message);
      },
      onSuccess: (_data, { archived }) => {
        toast.success(archived ? "Pedido arquivado!" : "Pedido restaurado!");
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: orpc.kitchen.list.key() });
      },
    }),
  );
}

export function useMutationCreateKitchenOrder() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.kitchen.create.mutationOptions({
      onSuccess: () => {
        toast.success("Pedido registrado!");
        queryClient.invalidateQueries({ queryKey: orpc.kitchen.list.key() });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
}

// Cria vários pedidos de uma mesma mesa numa única requisição (lote).
export function useMutationCreateKitchenOrders() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.kitchen.createMany.mutationOptions({
      onSuccess: ({ count }) => {
        toast.success(
          count > 1 ? `${count} pedidos registrados!` : "Pedido registrado!",
        );
        queryClient.invalidateQueries({ queryKey: orpc.kitchen.list.key() });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
}

export function useMutationMoveKitchenOrder() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.kitchen.move.mutationOptions({
      // Update otimista: move o card de coluna imediatamente, evitando o "pisca"
      // até o próximo polling. Rollback em onError (ex.: estourou WIP no servidor).
      onMutate: async ({ id, toColumnId }) => {
        await queryClient.cancelQueries({ queryKey: ordersQueryKey });
        const previous =
          queryClient.getQueryData<KitchenOrder[]>(ordersQueryKey);

        queryClient.setQueryData<KitchenOrder[]>(ordersQueryKey, (old) =>
          old?.map((order) =>
            order.id === id
              ? {
                  ...order,
                  columnId: toColumnId,
                  columnEnteredAt: new Date().toISOString(),
                }
              : order,
          ),
        );

        return { previous };
      },
      onError: (error, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(ordersQueryKey, context.previous);
        }
        toast.error(error.message);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: orpc.kitchen.list.key() });
      },
    }),
  );
}

// --- Pedidos do cardápio aguardando aceite ------------------------------

export function useQueryPendingTickets() {
  return useQuery(
    orpc.kitchen.listPendingTickets.queryOptions({
      input: {},
      refetchInterval: POLL_MS,
    }),
  );
}

function useInvalidarFilaDeAceite() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.kitchen.listPendingTickets.key(),
    });
    queryClient.invalidateQueries({ queryKey: orpc.kitchen.list.key() });
    queryClient.invalidateQueries({
      queryKey: orpc.kitchen.listPendingPrint.key(),
    });
  };
}

export function useMutationAcceptTicket() {
  const invalidar = useInvalidarFilaDeAceite();
  return useMutation(
    orpc.kitchen.acceptTicket.mutationOptions({
      onSuccess: () => {
        toast.success("Pedido aceito! Já foi para a cozinha.");
        invalidar();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useMutationRejectTicket() {
  const invalidar = useInvalidarFilaDeAceite();
  return useMutation(
    orpc.kitchen.rejectTicket.mutationOptions({
      onSuccess: () => {
        toast.success("Pedido recusado.");
        invalidar();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useMutationMoveTicket() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.kitchen.moveTicket.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: orpc.kitchen.list.key() });
      },
    }),
  );
}
