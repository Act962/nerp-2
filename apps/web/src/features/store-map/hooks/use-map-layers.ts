"use client";

import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export function useMapLayerMutations() {
  const create = useMutation(orpc.mapLayer.create.mutationOptions({}));
  const update = useMutation(orpc.mapLayer.update.mutationOptions({}));
  const remove = useMutation(
    orpc.mapLayer.delete.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
  const reorder = useMutation(orpc.mapLayer.reorder.mutationOptions({}));

  return { create, update, remove, reorder };
}
