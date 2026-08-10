import { orpc } from "@/lib/orpc";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

interface UseProductsProps {
  category?: string[];
  name?: string;
  sku?: string;
  search?: string;
  minValue?: string;
  maxValue?: string;
  dateInit?: Date;
  dateEnd?: Date;
  cursor?: string;
  limit?: number;
}

export function useProducts({
  cursor,
  limit = 10,
  category,
  name,
  sku,
  search,
  minValue,
  maxValue,
  dateInit,
  dateEnd,
}: UseProductsProps) {
  const { data, isLoading } = useQuery(
    orpc.products.list.queryOptions({
      input: {
        category,
        name,
        sku,
        search,
        minValue,
        maxValue,
        dateInit,
        dateEnd,
        cursor,
        limit,
      },
      // Mantém os resultados anteriores durante o refetch (busca por
      // digitação): a grade não pisca a cada tecla.
      placeholderData: keepPreviousData,
    }),
  );
  return {
    data: data?.products || [],
    totalCount: data?.totalCount,
    nextCursor: data?.nextCursor ?? null,
    hasNextPage: data?.hasNextPage ?? false,
    isLoading,
  };
}

interface useQueryProductsOfCartProps {
  subdomain: string;
  productIds: string[];
}

export function useQueryProductsOfCart({
  subdomain,
  productIds,
}: useQueryProductsOfCartProps) {
  const { data, isLoading } = useQuery(
    orpc.catalogSettings.listProductsOfCart.queryOptions({
      input: {
        subdomain,
        productIds,
      },
    }),
  );
  return {
    data: data?.products || [],
    isLoading,
  };
}

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.products.create.mutationOptions({
      onSuccess: () => {
        // router.push("/produtos");

        queryClient.invalidateQueries({
          queryKey: orpc.products.list.key(),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
};
