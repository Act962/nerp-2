"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function useTradeDashboard() {
  const { data, isPending } = useQuery(
    orpc.tradeDashboard.overview.queryOptions({ input: {} }),
  );
  return { data, isLoading: isPending };
}
