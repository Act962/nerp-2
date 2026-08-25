"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Mora em `src/hooks` desde que o mapa de campo também passou a precisar dele;
// reexportado aqui para os call sites deste módulo não mudarem.
export { useIsSuperAdmin } from "@/hooks/use-is-super-admin";

export function useMediaModelPhotos() {
  const { data, isPending } = useQuery(
    orpc.mediaModelPhoto.list.queryOptions({ input: {} }),
  );
  return { photos: data?.items ?? [], isLoading: isPending };
}

function useInvalidateModelPhotos() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: orpc.mediaModelPhoto.list.key(),
    });
}

export function useCreateMediaModelPhoto() {
  const invalidate = useInvalidateModelPhotos();
  return useMutation(
    orpc.mediaModelPhoto.create.mutationOptions({
      onSuccess: () => {
        toast.success("Foto adicionada à biblioteca");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteMediaModelPhoto() {
  const invalidate = useInvalidateModelPhotos();
  return useMutation(
    orpc.mediaModelPhoto.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Foto removida da biblioteca");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
