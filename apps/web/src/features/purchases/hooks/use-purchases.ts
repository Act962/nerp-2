"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function usePurchases(input: {
  status?: "PENDING" | "CONFIRMED" | "RECEIVED" | "CANCELLED";
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery(orpc.purchase.list.queryOptions({ input }));
}

export function usePurchase(id: string | undefined) {
  return useQuery(
    orpc.purchase.get.queryOptions({
      input: { id: id ?? "" },
      enabled: Boolean(id),
    }),
  );
}

function useInvalidatePurchases() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.purchase.list.key() });
    queryClient.invalidateQueries({ queryKey: orpc.purchase.get.key() });
  };
}

export function useCreatePurchase() {
  const invalidate = useInvalidatePurchases();
  return useMutation(
    orpc.purchase.create.mutationOptions({
      onSuccess: (result) => {
        toast.success(`Entrada #${result.purchaseNumber} salva como rascunho`);
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdatePurchase() {
  const invalidate = useInvalidatePurchases();
  return useMutation(
    orpc.purchase.update.mutationOptions({
      onSuccess: () => {
        toast.success("Rascunho salvo");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/**
 * Processar mexe em quatro domínios de uma vez — estoque, produto, custo e
 * financeiro. Tudo que lê algum deles precisa ser invalidado, senão a tela ao
 * lado continua mostrando o saldo de antes da nota.
 */
export function useProcessPurchase() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.purchase.process.mutationOptions({
      onSuccess: (result) => {
        const partes = [
          `${result.itemsMoved} no estoque`,
          `${result.costsUpdated} custos`,
        ];
        if (result.pricesUpdated > 0) {
          partes.push(`${result.pricesUpdated} preços de venda`);
        }
        if (result.payableEntries > 0) {
          partes.push(`${result.payableEntries} parcelas a pagar`);
        }
        toast.success(
          `Entrada #${result.purchaseNumber} processada — ${partes.join(" · ")}`,
        );

        for (const key of [
          orpc.purchase.list.key(),
          orpc.purchase.get.key(),
          orpc.products.list.key(),
          orpc.stocks.list.key(),
          orpc.financeiro.entries.list.key(),
        ]) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useCancelPurchase() {
  const invalidate = useInvalidatePurchases();
  return useMutation(
    orpc.purchase.cancel.mutationOptions({
      onSuccess: () => {
        toast.success("Entrada cancelada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useQuickCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.purchase.quickCreateProduct.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.alreadyExisted
            ? `${result.product.name} já estava cadastrado`
            : `${result.product.name} cadastrado`,
        );
        queryClient.invalidateQueries({ queryKey: orpc.products.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
