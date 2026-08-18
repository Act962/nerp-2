"use client";

import { orpc } from "@/lib/orpc";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useTradeCatalogs() {
  const { data, isPending } = useQuery(
    orpc.tradeCatalogDoc.list.queryOptions({ input: {} }),
  );
  return { catalogs: data?.catalogs ?? [], isLoading: isPending };
}

export function useTradeCatalog(id: string) {
  const query = useQuery({
    ...orpc.tradeCatalogDoc.getOne.queryOptions({ input: { id } }),
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data?.status === "GENERATING" ? 2500 : false,
  });
  return { catalog: query.data, isLoading: query.isPending };
}

function useInvalidateTradeCatalogs() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.tradeCatalogDoc.list.key() });
    queryClient.invalidateQueries({ queryKey: orpc.tradeCatalogDoc.getOne.key() });
  };
}

export function useCreateTradeCatalog() {
  const invalidate = useInvalidateTradeCatalogs();
  return useMutation(
    orpc.tradeCatalogDoc.create.mutationOptions({
      onSuccess: () => {
        toast.success("Catálogo criado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateTradeCatalog() {
  const invalidate = useInvalidateTradeCatalogs();
  return useMutation(
    orpc.tradeCatalogDoc.update.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteTradeCatalog() {
  const invalidate = useInvalidateTradeCatalogs();
  return useMutation(
    orpc.tradeCatalogDoc.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Catálogo excluído");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useGenerateTradeCatalogPages() {
  const invalidate = useInvalidateTradeCatalogs();
  return useMutation(
    orpc.tradeCatalogDoc.generatePages.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.pageIds.length} página(s) geradas`);
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateTradeCatalogPage() {
  const invalidate = useInvalidateTradeCatalogs();
  return useMutation(
    orpc.tradeCatalogDoc.updatePage.mutationOptions({
      onError: (error) => {
        toast.error(error.message);
        invalidate();
      },
    }),
  );
}

export function useReorderTradeCatalogPages() {
  const invalidate = useInvalidateTradeCatalogs();
  return useMutation(
    orpc.tradeCatalogDoc.reorderPages.mutationOptions({
      onError: (error) => {
        toast.error(error.message);
        invalidate();
      },
    }),
  );
}

export function useDeleteTradeCatalogPage() {
  const invalidate = useInvalidateTradeCatalogs();
  return useMutation(
    orpc.tradeCatalogDoc.deletePage.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useGenerateTradeCatalogPdf() {
  const invalidate = useInvalidateTradeCatalogs();
  return useMutation(
    orpc.tradeCatalogDoc.generate.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.status === "READY"
            ? "Catálogo gerado com sucesso!"
            : "Gerando o catálogo em PDF…",
        );
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateTradeCatalogCoverLayout() {
  return useMutation(
    orpc.tradeCatalogDoc.updateCoverLayout.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUploadCatalogCoverImage() {
  return useMutation({
    mutationFn: (file: File) => uploadToR2(file, true),
    onError: () => toast.error("Falha ao enviar imagem"),
  });
}
