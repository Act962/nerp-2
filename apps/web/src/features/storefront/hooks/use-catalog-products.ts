import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

interface UseCatalogProductsProps {
  subdomain: string;
  categories?: string[];
  minValue?: number;
  maxValue?: number;
}

export function useQueryCatalogProducts({
  subdomain,
  categories,
  minValue,
  maxValue,
}: UseCatalogProductsProps) {
  const { data, isLoading } = useQuery(
    orpc.catalogSettings.listProducts.queryOptions({
      input: {
        subdomain,
        categorySlugs: categories ?? undefined,
        maxValue: maxValue ?? undefined,
        minValue: minValue ?? undefined,
      },
      enabled: !!subdomain,
      placeholderData: (previousData) => previousData,
    })
  );

  return {
    data: data,
    isLoadingProducts: isLoading,
  };
}
