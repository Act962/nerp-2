import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

interface UseProductDetailsProps {
  subdomain: string;
  slug: string;
}

export function useProductDetails({ subdomain, slug }: UseProductDetailsProps) {
  return useQuery(
    orpc.catalogSettings.relatedProducts.queryOptions({
      input: {
        subdomain,
        productSlug: slug,
      },
      enabled: !!subdomain && !!slug,
    }),
  );
}
