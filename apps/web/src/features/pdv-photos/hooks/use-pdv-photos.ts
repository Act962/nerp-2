"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface PdvPhotoFilters {
  storeId?: string;
  mapObjectId?: string;
  // Fotos tiradas em campo antes de a loja ter mapa.
  unlinkedOnly?: boolean;
  supplierId?: string;
  mediaTypeId?: string;
  section?: string;
  responsibleCompany?: string;
  coordinatorName?: string;
  consultantName?: string;
  code?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function usePdvPhotos(filters: PdvPhotoFilters, enabled = true) {
  const { data, isPending } = useQuery({
    ...orpc.pdvPhoto.list.queryOptions({ input: filters }),
    enabled,
  });

  return { photos: data?.photos ?? [], isLoading: isPending };
}

export type PdvPhoto = ReturnType<typeof usePdvPhotos>["photos"][number];

export function usePdvFilterOptions() {
  const { data } = useQuery(
    orpc.pdvPhoto.filterOptions.queryOptions({ input: {} }),
  );
  return (
    data ?? {
      sections: [],
      companies: [],
      coordinators: [],
      consultants: [],
      codes: [],
    }
  );
}

function useInvalidatePdvPhotos() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.pdvPhoto.list.key() });
    queryClient.invalidateQueries({
      queryKey: orpc.pdvPhoto.filterOptions.key(),
    });
    queryClient.invalidateQueries({ queryKey: orpc.store.list.key() });
    // PdvPhoto também aparece embutido nas páginas do Book (book.getOne) —
    // sem isso, upload de foto/edição de campo lá não reflete sem F5.
    queryClient.invalidateQueries({ queryKey: orpc.book.getOne.key() });
    // Fotografar carimba última visita/promotor no elemento do mapa.
    queryClient.invalidateQueries({ queryKey: orpc.mapObject.getAudit.key() });
  };
}

export function useCreatePdvPhoto() {
  const invalidate = useInvalidatePdvPhotos();
  return useMutation(
    orpc.pdvPhoto.create.mutationOptions({
      onSuccess: () => {
        toast.success("Foto do PDV registrada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdatePdvPhoto(options?: { silent?: boolean }) {
  const invalidate = useInvalidatePdvPhotos();
  return useMutation(
    orpc.pdvPhoto.update.mutationOptions({
      onSuccess: () => {
        if (!options?.silent) toast.success("Foto do PDV atualizada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useLinkPhotoToMapObject() {
  const invalidate = useInvalidatePdvPhotos();
  return useMutation(
    orpc.pdvPhoto.linkMapObject.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.mapObjectId
            ? "Foto vinculada ao espaço do mapa"
            : "Vínculo removido",
        );
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeletePdvPhoto() {
  const invalidate = useInvalidatePdvPhotos();
  return useMutation(
    orpc.pdvPhoto.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Foto do PDV excluída");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
