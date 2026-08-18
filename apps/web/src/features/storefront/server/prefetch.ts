import { router } from "@/app/router";
import { orpc } from "@/lib/orpc";
import { InferRouterInputs } from "@orpc/server";
import { QueryClient } from "@tanstack/react-query";

type Input = InferRouterInputs<typeof router.catalogSettings.list>;

export function PrefetchCatalogSettings(
  queryClient: QueryClient,
  params: Input
) {
  return queryClient.prefetchQuery(orpc.catalogSettings.list.queryOptions());
}
