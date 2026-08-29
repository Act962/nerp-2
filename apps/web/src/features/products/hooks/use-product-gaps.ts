"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function useProductGaps() {
  return useQuery(orpc.products.gapsSummary.queryOptions({ input: {} }));
}
