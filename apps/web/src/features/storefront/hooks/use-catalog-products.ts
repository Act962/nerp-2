import { orpc } from "@/lib/orpc";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

interface UseCatalogProductsProps {
  subdomain: string;
  categories?: string[];
  minValue?: number;
  maxValue?: number;
  search?: string;
}

const PRODUTOS_POR_PAGINA = 24;

export function useQueryCatalogProducts({
  subdomain,
  categories,
  minValue,
  maxValue,
  search,
}: UseCatalogProductsProps) {
  const query = useInfiniteQuery(
    orpc.catalogSettings.listProducts.infiniteOptions({
      input: (cursor: string | undefined) => ({
        subdomain,
        categorySlugs: categories,
        maxValue,
        minValue,
        search: search || undefined,
        cursor,
        limit: PRODUTOS_POR_PAGINA,
      }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (ultima) => ultima.nextCursor ?? undefined,
      enabled: !!subdomain,
      // Trocar filtro ou busca mantém a lista anterior na tela até a nova
      // chegar, em vez de piscar o esqueleto.
      placeholderData: (anterior) => anterior,
      // Uma infinite query refaz TODAS as páginas carregadas, em sequência,
      // quando é revalidada. Voltar para a aba depois de rolar o catálogo
      // longe dispararia dezenas de requisições para trazer o mesmo.
      refetchOnWindowFocus: false,
    }),
  );

  return {
    products: query.data?.pages.flatMap((pagina) => pagina.products) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
    isLoadingProducts: query.isLoading,
    isFetchingFirstPage: query.isFetching && !query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}

export function useQueryCatalogCategories(subdomain: string) {
  const { data, isLoading } = useQuery(
    orpc.catalogSettings.publicCategories.queryOptions({
      input: { subdomain },
      enabled: !!subdomain,
    }),
  );
  return { categories: data, isLoadingCategories: isLoading };
}

export function useQueryCatalogOffers(subdomain: string) {
  const { data } = useQuery(
    orpc.catalogSettings.listOffers.queryOptions({
      input: { subdomain },
      enabled: !!subdomain,
    }),
  );
  return { offers: data ?? [] };
}
