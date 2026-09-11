import { orpc } from "@/lib/orpc";
import {
  type QueryClient,
  useMutation,
  usePrefetchQuery,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { SalesPeriod } from "../lib/period-range";

interface useQuerySalesProps {
  period?: SalesPeriod;
  dateInit?: Date;
  dateEnd?: Date;
  methodPayment?: string;
  status?: string;
  minValue?: number;
  maxValue?: number;
}

export function useQuerySales({
  period,
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
        period,
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
      onError: (erro) => {
        /*
          A mensagem do servidor, e não "Erro ao criar venda!".

          As recusas daqui são específicas e acionáveis — "a soma dos
          pagamentos não bate com o total", "produto sem estoque" —, e o
          `onError` as jogava fora. Quem estava no caixa via uma frase que não
          diz o que fazer, e quem fosse investigar precisava do log do
          servidor.

          Falha inesperada continua sem detalhe (o oRPC devolve texto
          genérico), e para essa há o complemento sobre o log.
        */
        const mensagem = erro.message?.trim();
        const inutil =
          !mensagem ||
          /^internal server error$/i.test(mensagem) ||
          /^unknown error$/i.test(mensagem);
        toast.error(
          inutil
            ? "Não consegui registrar a venda. O motivo está no log do servidor."
            : mensagem,
        );
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
