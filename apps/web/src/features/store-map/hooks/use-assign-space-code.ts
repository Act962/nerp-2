"use client";

import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

// Gera/regenera o Digital Space ID no servidor. O componente atualiza o store
// local no onSuccess para o autosave seguinte não reenviar o valor antigo.
export function useAssignSpaceCode() {
  return useMutation(
    orpc.mapObject.assignSpaceCode.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}
