"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery } from "@tanstack/react-query";

export interface MapViewport {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Pontos do mapa público. Recortado pela área visível — o catálogo cobre o
 * Brasil e mandar tudo seria inútil e caro num endpoint sem autenticação.
 *
 * `placeholderData` segura o conjunto anterior enquanto o novo carrega: sem
 * isso os pinos somem a cada movimento, porque a área faz parte da chave.
 */
export function usePublicMapPoints(viewport: MapViewport | null) {
  const query = useQuery({
    ...orpc.tradegramPublic.getPublicMapPoints.queryOptions({
      input: viewport ?? { south: -34, west: -74, north: 6, east: -34 },
    }),
    enabled: viewport !== null,
    placeholderData: (previousData) => previousData,
  });
  return {
    points: query.data?.points ?? [],
    truncated: query.data?.truncated ?? false,
    isLoading: query.isPending,
  };
}

/** Tamanho do mercado mapeado. Público — serve inclusive ao cadastro. */
export function useMarketSize(state?: string | null, city?: string | null) {
  const query = useQuery(
    orpc.tradegramPublic.marketSize.queryOptions({
      input: { state: state ?? undefined, city: city ?? undefined },
      placeholderData: (previousData) => previousData,
    }),
  );
  return { data: query.data, isLoading: query.isPending };
}

export function usePublicCompany(companyId: string) {
  return useQuery(
    orpc.tradegramPublic.getPublicCompany.queryOptions({
      input: { companyId },
    }),
  );
}

export function usePublicGroup(orgSlug: string) {
  return useQuery(
    orpc.tradegramPublic.getPublicGroup.queryOptions({ input: { orgSlug } }),
  );
}

export function usePublicStore(orgSlug: string, storeId: string) {
  return useQuery(
    orpc.tradegramPublic.getPublicStore.queryOptions({
      input: { orgSlug, storeId },
    }),
  );
}

export function usePublicStoreMap(
  orgSlug: string,
  storeId: string,
  floorPlanId?: string,
) {
  return useQuery(
    orpc.tradegramPublic.getPublicStoreMap.queryOptions({
      input: { orgSlug, storeId, floorPlanId },
    }),
  );
}

export function usePublicStoreMedia(
  orgSlug: string,
  storeId: string,
  mediaCode: string,
) {
  return useQuery(
    orpc.tradegramPublic.getPublicStoreMedia.queryOptions({
      input: { orgSlug, storeId, mediaCode },
    }),
  );
}

export function useTradegramSearch(q: string) {
  return useQuery({
    ...orpc.tradegramPublic.search.queryOptions({ input: { q } }),
    enabled: q.trim().length > 0,
  });
}

export function useCreateTradegramInterest() {
  return useMutation(orpc.tradegramPublic.createInterest.mutationOptions());
}
