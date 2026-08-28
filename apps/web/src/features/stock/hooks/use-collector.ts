"use client";

import { client, orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type CollectorOperation = "ENTRADA" | "SAIDA" | "INVENTARIO";

export interface CollectorProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  currentStock: number;
  unit: string;
}

/**
 * Busca por código de barras ou SKU. Chamada direta (não `useQuery`) porque o
 * disparo é o bipe do leitor, não a renderização — cachear por código
 * devolveria o estoque velho no segundo bipe do mesmo item, que é justamente o
 * número que o operador está conferindo.
 */
export async function findProductByCode(
  code: string,
): Promise<CollectorProduct | null> {
  const { product } = await client.products.findByCode({ code });
  return product;
}

function useInvalidateStock() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.stocks.list.key() });
    queryClient.invalidateQueries({ queryKey: orpc.products.list.key() });
  };
}

export function useRegisterEntry() {
  const invalidate = useInvalidateStock();
  return useMutation(
    orpc.stocks.create.entry.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRegisterOutput() {
  const invalidate = useInvalidateStock();
  return useMutation(
    orpc.stocks.create.output.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRegisterAdjustment() {
  const invalidate = useInvalidateStock();
  return useMutation(
    orpc.stocks.create.adjustment.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}
