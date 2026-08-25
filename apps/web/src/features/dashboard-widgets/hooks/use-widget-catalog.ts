"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useWidgetCatalog() {
  return useQuery(orpc.dashboardWidgets.catalog.queryOptions({ input: {} }));
}
