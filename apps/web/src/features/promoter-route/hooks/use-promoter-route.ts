"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function useInvalidateRoute() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.promoterRoute.get.key() });
    // A lista de clientes carrega o "já está na rota" — sem invalidar as duas,
    // adicionar uma parada deixa o botão dizendo "adicionar" para sempre.
    queryClient.invalidateQueries({
      queryKey: orpc.promoterRoute.routableStores.key(),
    });
  };
}

export function useMyRoute() {
  const query = useQuery(orpc.promoterRoute.get.queryOptions({ input: {} }));
  return {
    stops: query.data?.stops ?? [],
    totalMeters: query.data?.totalMeters ?? 0,
    optimizedAt: query.data?.optimizedAt ?? null,
    isLoading: query.isPending,
  };
}

/**
 * Clientes que dá para colocar na rota.
 *
 * A busca vai ao servidor porque o recorte de quem enxerga o quê é dele — um
 * filtro local sobre "todas as lojas" mostraria carteira alheia.
 */
export function useRoutableStores(search: string) {
  const query = useQuery(
    orpc.promoterRoute.routableStores.queryOptions({
      input: { search: search.trim() || undefined },
      placeholderData: (previousData) => previousData,
    }),
  );
  return {
    stores: query.data?.stores ?? [],
    withoutPosition: query.data?.withoutPosition ?? 0,
    isLoading: query.isPending,
  };
}

export function useAddRouteStop() {
  const invalidate = useInvalidateRoute();
  return useMutation(
    orpc.promoterRoute.addStop.mutationOptions({
      onSuccess: () => {
        toast.success("Adicionado à sua rota");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRemoveRouteStop() {
  const invalidate = useInvalidateRoute();
  return useMutation(
    orpc.promoterRoute.removeStop.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useReorderRoute() {
  const invalidate = useInvalidateRoute();
  return useMutation(
    orpc.promoterRoute.reorder.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useOptimizeRoute() {
  const invalidate = useInvalidateRoute();
  return useMutation(
    orpc.promoterRoute.optimize.mutationOptions({
      onSuccess: (result) => {
        const saved = result.beforeMeters - result.afterMeters;
        toast.success(
          saved > 0
            ? `Rota ${(saved / 1000).toFixed(1)} km mais curta`
            : "A ordem atual já era a melhor que encontrei",
        );
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
