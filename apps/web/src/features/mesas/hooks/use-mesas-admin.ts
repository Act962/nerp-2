"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useMesas(incluirInativas = false) {
  return useQuery(orpc.mesa.list.queryOptions({ input: { incluirInativas } }));
}

function useInvalidar() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.mesa.list.key() });
    queryClient.invalidateQueries({ queryKey: orpc.mesa.listForWaiter.key() });
  };
}

export function useCriarMesas() {
  const invalidar = useInvalidar();
  return useMutation(
    orpc.mesa.create.mutationOptions({
      onSuccess: ({ criadas, puladas }) => {
        if (criadas === 0) {
          toast.info("Essas mesas já existiam.");
        } else {
          toast.success(
            puladas > 0
              ? `${criadas} mesas criadas (${puladas} já existiam).`
              : `${criadas} ${criadas === 1 ? "mesa criada" : "mesas criadas"}.`,
          );
        }
        invalidar();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useAtualizarMesa() {
  const invalidar = useInvalidar();
  return useMutation(
    orpc.mesa.update.mutationOptions({
      onSuccess: () => {
        toast.success("Mesa atualizada");
        invalidar();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
