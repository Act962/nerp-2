import { orpc } from "@/lib/orpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { avisarErro } from "@/features/billing/hooks/use-limite-do-plano";

/** Dispara a criação da importação (registro + evento Inngest). */
export const useCreateCustomerImport = () => {
  return useMutation(
    orpc.customer.import.create.mutationOptions({
      onError: avisarErro,
    }),
  );
};

/**
 * Acompanha o status de uma importação. Faz polling a cada 2s enquanto o status
 * não for terminal (COMPLETED/FAILED). `importId` nulo desabilita a query.
 */
export const useCustomerImportStatus = (importId: string | null) => {
  return useQuery(
    orpc.customer.import.get.queryOptions({
      input: { importId: importId ?? "" },
      enabled: !!importId,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === "COMPLETED" || status === "FAILED") return false;
        return 2000;
      },
    }),
  );
};
