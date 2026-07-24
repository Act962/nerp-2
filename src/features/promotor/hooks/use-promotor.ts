"use client";

import { client, orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type PromotorPhotoStatus = "ALL" | "APPROVED" | "REJECTED" | "PENDING";

export function useMyPhotos(status: PromotorPhotoStatus) {
  const query = useQuery(
    orpc.promotor.myPhotos.queryOptions({ input: { status } }),
  );
  return {
    photos: query.data?.photos ?? [],
    counts: query.data?.counts ?? {
      all: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
    },
    isLoading: query.isPending,
  };
}

export function useCapturePromotorPhoto() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotor.capture.mutationOptions({
      onSuccess: () => {
        toast.success("Foto enviada");
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.myPhotos.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.forApproval.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.book.dashboard.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Chamado imperativo dentro do fluxo de captura (uma vez, dentro de um handler
// async), então usa o client cru em vez de um hook de query.
export function reverseGeocode(latitude: number, longitude: number) {
  return client.promotor.reverseGeocode({ latitude, longitude });
}

// ── Aprovação (coordenadora) ──────────────────────────────────────────────

export function usePhotosForApproval(status: PromotorPhotoStatus) {
  const query = useQuery(
    orpc.promotor.forApproval.queryOptions({ input: { status } }),
  );
  return {
    photos: query.data?.photos ?? [],
    counts: query.data?.counts ?? { pending: 0, approved: 0, rejected: 0 },
    isLoading: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}

function useInvalidateApproval() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.promotor.forApproval.key(),
    });
    queryClient.invalidateQueries({ queryKey: orpc.promotor.myPhotos.key() });
    queryClient.invalidateQueries({ queryKey: orpc.book.dashboard.key() });
    queryClient.invalidateQueries({
      queryKey: orpc.promotor.approvedForImport.key(),
    });
  };
}

export function useReviewPromotorPhoto() {
  const invalidate = useInvalidateApproval();
  return useMutation(
    orpc.promotor.reviewPhoto.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useApprovedForImport(
  storeId: string | undefined,
  supplierId: string | undefined,
  enabled: boolean,
) {
  const query = useQuery({
    ...orpc.promotor.approvedForImport.queryOptions({
      input: { storeId, supplierId },
    }),
    enabled,
  });
  return { photos: query.data?.photos ?? [], isLoading: query.isPending };
}
