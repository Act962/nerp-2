import { orpc } from "@/lib/orpc";
import {
  type QueryClient,
  useMutation,
  usePrefetchQuery,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

interface useQuerySalesProps {
  dateInit?: Date;
  dateEnd?: Date;
  methodPayment?: string;
  status?: string;
  minValue?: number;
  maxValue?: number;
}

export function useQuerySales({
  dateInit,
  dateEnd,
  methodPayment,
  status,
  minValue,
  maxValue,
}: useQuerySalesProps) {
  const { data, isLoading } = useQuery(
    orpc.sales.list.queryOptions({
      input: {
        dateInit,
        dateEnd,
        methodPayment,
        status,
        minValue,
        maxValue,
      },
    }),
  );

  return {
    data: data?.sales || [],
    isLoadingSales: isLoading,
  };
}

export const useMutationCreateSale = () => {
  return useMutation(
    orpc.sales.create.mutationOptions({
      onSuccess: () => {
        toast.success("Venda criada com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao criar venda!");
      },
    }),
  );
};

interface useQuerySaleProps {
  saleId: string;
}

export const useQuerySale = ({ saleId }: useQuerySaleProps) => {
  const { data, isLoading } = useQuery(
    orpc.sales.get.queryOptions({
      input: {
        saleId,
      },
    }),
  );

  return {
    data,
    isLoadingSale: isLoading,
  };
};

interface UseSalesByCustomerProps {
  customerId: string | null | undefined;
  from?: string;
  to?: string;
  enabled?: boolean;
}

// Histórico de vendas de um cliente + resumo (KPIs). Só dispara com um
// customerId válido — enabled=false enquanto o cliente não é escolhido.
export function useSalesByCustomer({
  customerId,
  from,
  to,
  enabled = true,
}: UseSalesByCustomerProps) {
  const query = useQuery(
    orpc.sales.listByCustomer.queryOptions({
      input: {
        customerId: customerId ?? "",
        from: from || undefined,
        to: to || undefined,
      },
      enabled: enabled && !!customerId,
    }),
  );
  return {
    summary: query.data?.summary ?? {
      salesCount: 0,
      totalSpent: 0,
      averageTicket: 0,
      lastSaleAt: null,
    },
    sales: query.data?.sales ?? [],
    isLoading: query.isPending && !!customerId,
  };
}

interface PrefetchSaleProps {
  saleId: string;
  queryClient: QueryClient;
}

export const PrefetchSale = ({ saleId, queryClient }: PrefetchSaleProps) => {
  return queryClient.prefetchQuery(
    orpc.sales.get.queryOptions({
      input: {
        saleId,
      },
    }),
  );
};
