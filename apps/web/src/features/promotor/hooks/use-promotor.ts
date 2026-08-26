"use client";

import { client, orpc } from "@/lib/orpc";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

export type PromotorPhotoStatus =
  | "ALL"
  | "APPROVED"
  | "REJECTED"
  | "PENDING"
  | "APP_GALLERY";

export type PhotoScope = {
  storeId?: string;
  supplierId?: string | null;
  promoterName?: string;
  mediaTypeId?: string;
  from?: string;
  to?: string;
};

export type ApprovalGroupBy = "store" | "promoter" | "supplier" | "media";

export function useMyPhotos(
  status: PromotorPhotoStatus,
  scope?: PhotoScope,
  enabled = true,
) {
  const query = useQuery({
    ...orpc.promotor.myPhotos.queryOptions({
      input: {
        status,
        storeId: scope?.storeId,
        supplierId: scope?.supplierId,
        from: scope?.from,
        to: scope?.to,
      },
    }),
    enabled,
  });
  return {
    photos: query.data?.photos ?? [],
    counts: query.data?.counts ?? {
      all: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      appGallery: 0,
    },
    isLoading: query.isPending,
  };
}

// Os quatro números dos chips e o alerta de reprovadas do cabeçalho. Sempre
// carregado: é o primeiro sinal que o promotor vê ao abrir o app.
export function useMyPhotoCounts(scope?: PhotoScope) {
  const query = useQuery(
    orpc.promotor.photoCounts.queryOptions({
      input: {
        storeId: scope?.storeId,
        supplierId: scope?.supplierId,
        from: scope?.from,
        to: scope?.to,
      },
    }),
  );
  return {
    counts: query.data ?? {
      all: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      appGallery: 0,
    },
    isLoading: query.isPending,
  };
}

// Rascunhos da Galeria App do promotor (fotos in-app ainda não enviadas), pro
// picker "Adicionar da Galeria App" no passo 3. Filtro por loja+indústria.
export function useGalleryDrafts(
  scope?: { storeId?: string; supplierId?: string },
  enabled = true,
) {
  const query = useQuery({
    ...orpc.promotor.galleryDrafts.queryOptions({
      input: { storeId: scope?.storeId, supplierId: scope?.supplierId },
    }),
    enabled,
  });
  return { photos: query.data?.photos ?? [], isLoading: query.isPending };
}

// Envia rascunhos selecionados pra fila da coordenadora (seta submittedAt).
export function useSubmitGalleryPhotos() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotor.submitGalleryPhotos.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.galleryDrafts.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.myPhotos.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.photoCounts.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.photoGroups.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Índice de "Minhas fotos": clientes (sem `storeId`) ou indústrias dentro de um
// cliente. Só contagens — as fotos vêm depois, já recortadas.
export function useMyPhotoGroups(
  status: PromotorPhotoStatus,
  storeId?: string,
  enabled = true,
  dates?: { from?: string; to?: string },
) {
  const query = useQuery({
    ...orpc.promotor.photoGroups.queryOptions({
      input: { status, storeId, from: dates?.from, to: dates?.to },
    }),
    enabled,
  });
  return { groups: query.data?.groups ?? [], isLoading: query.isPending };
}

// Indústrias vinculadas ao promotor (as que ele pode fotografar). Owner/admin
// recebem todas. Cursor infinito: a lista é uma busca digitada + rolagem
// (Command/lista, não tabela), então "carregar mais" no scroll é mais natural
// que paginação numerada aqui.
export function useMyIndustries(search?: string) {
  const query = useInfiniteQuery({
    ...orpc.promotor.myIndustries.infiniteOptions({
      input: (cursor: string | undefined) => ({ search, cursor }),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialPageParam: undefined,
    }),
  });
  return {
    suppliers: query.data?.pages.flatMap((page) => page.suppliers) ?? [],
    isLoading: query.isPending,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}

// Identificação do promotor (foto + WhatsApp) e marca da org, para o cabeçalho
// e para decidir se o app libera a captura.
export function usePromotorProfile() {
  const query = useQuery(orpc.promotor.profile.queryOptions({ input: {} }));
  return { profile: query.data, isLoading: query.isPending };
}

export function useUpdatePromotorProfile() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotor.updateProfile.mutationOptions({
      onSuccess: () => {
        toast.success("Perfil atualizado");
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.profile.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Lojas do wizard, com os favoritos do promotor no topo. Mesmo cursor
// infinito de `useMyIndustries` — organizações grandes têm milhares de lojas.
export function useMyStores(search?: string) {
  const query = useInfiniteQuery({
    ...orpc.promotor.myStores.infiniteOptions({
      input: (cursor: string | undefined) => ({ search, cursor }),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialPageParam: undefined,
    }),
  });
  return {
    stores: query.data?.pages.flatMap((page) => page.stores) ?? [],
    isLoading: query.isPending,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}

// Favoritar loja/indústria. Sem toast: a estrela já é o feedback, e o promotor
// costuma marcar várias seguidas — uma pilha de toasts atrapalharia.
export function useTogglePromotorFavorite() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotor.toggleFavorite.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.myStores.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.myIndustries.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Gestão (admin): vínculos de um membro/promotor.
export function useMemberLinks(memberId: string) {
  const query = useQuery({
    ...orpc.promotor.memberLinks.queryOptions({ input: { memberId } }),
    enabled: !!memberId,
  });
  return {
    supplierIds: query.data?.supplierIds ?? [],
    storeIds: query.data?.storeIds ?? [],
    distributorIds: query.data?.distributorIds ?? [],
    isLoading: query.isPending,
  };
}

export function useSetMemberLinks() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotor.setMemberLinks.mutationOptions({
      onSuccess: () => {
        toast.success("Vínculos salvos");
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.memberLinks.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.myIndustries.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useCapturePromotorPhoto() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotor.capture.mutationOptions({
      // O toast fica com quem chama (a mensagem muda entre Pendentes e Galeria).
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.myPhotos.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.photoGroups.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.photoCounts.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.forApproval.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotor.galleryDrafts.key(),
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

// Reporta o estado da permissão de geolocalização ao abrir o app. Fire-and-forget
// (client cru, sem query): é telemetria de status, não algo que a UI aguarda.
export function reportGeoState(
  state: "granted" | "denied" | "prompt" | "unavailable",
) {
  return client.promotor.reportGeoState({ state }).catch(() => undefined);
}

// ── Aprovação (coordenadora) ──────────────────────────────────────────────

export function useApprovalGroups(
  status: PromotorPhotoStatus,
  storeId?: string,
  enabled = true,
  dates?: { from?: string; to?: string },
  groupBy: ApprovalGroupBy = "store",
) {
  const query = useQuery({
    ...orpc.promotor.approvalGroups.queryOptions({
      input: { status, groupBy, storeId, from: dates?.from, to: dates?.to },
    }),
    enabled,
  });
  return { groups: query.data?.groups ?? [], isLoading: query.isPending };
}

export function useApplySeal() {
  const invalidate = useInvalidateApproval();
  return useMutation(
    orpc.promotor.applySeal.mutationOptions({
      onSuccess: () => {
        toast.success("Senha do mês aplicada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function usePhotosForApproval(
  status: PromotorPhotoStatus,
  scope?: PhotoScope,
  enabled = true,
) {
  const query = useQuery({
    ...orpc.promotor.forApproval.queryOptions({
      input: {
        status,
        storeId: scope?.storeId,
        supplierId: scope?.supplierId,
        promoterName: scope?.promoterName,
        mediaTypeId: scope?.mediaTypeId,
        from: scope?.from,
        to: scope?.to,
      },
    }),
    enabled,
  });
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
    queryClient.invalidateQueries({
      queryKey: orpc.promotor.approvalGroups.key(),
    });
    queryClient.invalidateQueries({ queryKey: orpc.promotor.myPhotos.key() });
    queryClient.invalidateQueries({
      queryKey: orpc.promotor.photoGroups.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.promotor.photoCounts.key(),
    });
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

export function useReviewPromotorPhotosBulk() {
  const invalidate = useInvalidateApproval();
  return useMutation(
    orpc.promotor.reviewPhotosBulk.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.count} foto(s) atualizada(s)`);
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useApprovedForImport(
  storeId: string | undefined,
  supplierId: string | undefined,
  enabled: boolean,
  // Opcional: marca `usedInBook` nas fotos já usadas neste book (aviso de
  // repetição no picker).
  bookId?: string,
  // Opcional: só as fotos marcadas com "Gostei".
  likedOnly?: boolean,
) {
  const query = useQuery({
    ...orpc.promotor.approvedForImport.queryOptions({
      input: { storeId, supplierId, bookId, likedOnly },
    }),
    enabled,
  });
  return { photos: query.data?.photos ?? [], isLoading: query.isPending };
}

// Quantas fotos aprovadas cada loja tem para uma indústria — pro seletor de
// loja do picker mostrar a contagem ao lado de cada loja/cliente.
export function useApprovedCountByStore(
  supplierId: string | undefined,
  enabled: boolean,
) {
  const query = useQuery({
    ...orpc.promotor.approvedCountByStore.queryOptions({
      input: { supplierId },
    }),
    enabled,
  });
  const countByStore = new Map(
    (query.data?.counts ?? []).map((c) => [c.storeId, c.count] as const),
  );
  return { countByStore, isLoading: query.isPending };
}
