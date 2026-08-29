import type { MissingField } from "@/features/products/lib/missing-filters";
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
  /** Lacuna de cadastro vinda dos cards do painel. */
  missing?: MissingField;
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
  missing,
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
        missing,
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

// Atualiza um patch (isActive / trackStock / showInCatalog) em vários
// produtos de uma vez. Usado pela toolbar de seleção em /produtos.
export const useBulkUpdateProducts = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.products.bulkUpdate.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.products.list.key(),
        });
        toast.success(
          data.updated === 1
            ? "1 produto atualizado"
            : `${data.updated} produtos atualizados`,
        );
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
};
