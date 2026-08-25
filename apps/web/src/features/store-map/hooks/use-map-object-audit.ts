"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function useMapObjectAudit(mapObjectId: string | undefined) {
  const { data, isLoading } = useQuery({
    ...orpc.mapObject.getAudit.queryOptions({
      input: { id: mapObjectId ?? "" },
    }),
    enabled: !!mapObjectId,
  });

  return { audit: data, isLoading };
}
