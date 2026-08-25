"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function useShopperInsights(days = 30) {
  return useQuery(
    orpc.shopperInsights.overview.queryOptions({ input: { days } }),
  );
}
