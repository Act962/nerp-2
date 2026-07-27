"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery } from "@tanstack/react-query";

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
