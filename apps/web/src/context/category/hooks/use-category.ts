import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useCategories() {
  const { data, isLoading } = useQuery(
    orpc.categories.listWithoutSubcategory.queryOptions()
  );

  return {
    categories: data?.categories || [],
    isLoadingCategories: isLoading,
  };
}
