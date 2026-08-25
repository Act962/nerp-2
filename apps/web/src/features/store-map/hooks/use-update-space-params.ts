"use client";

import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

// Campos da Biblioteca Nacional (mediaType/sector/tier/fluxo/visibilidade/
// exclusividade/potencial/venda média). Fica FORA do bulk-upsert de propósito
// — o componente sincroniza o store local no onSuccess, igual assignSpaceCode.
export function useUpdateSpaceParams() {
  return useMutation(
    orpc.mapObject.updateSpaceParams.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}
