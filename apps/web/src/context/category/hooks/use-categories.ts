import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useCategory() {
  const { data, isLoading } = useQuery(orpc.categories.listAll.queryOptions());

  return {
    categories: data?.categories || [],
    isLoadingCategories: isLoading,
  };
}
