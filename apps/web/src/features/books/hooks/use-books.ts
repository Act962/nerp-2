"use client";

import { orpc } from "@/lib/orpc";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CoverBackground, CoverElement } from "../lib/cover-layout";

export function useBooks() {
  const { data, isPending } = useQuery(
    orpc.book.list.queryOptions({ input: {} }),
  );
  return { books: data?.books ?? [], isLoading: isPending };
}

export function useBook(id: string) {
  const query = useQuery({
    ...orpc.book.getOne.queryOptions({ input: { id } }),
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data?.status === "GENERATING" ? 2500 : false,
  });
  return { book: query.data, isLoading: query.isPending };
}

export function useBookDashboard() {
  const query = useQuery(orpc.book.dashboard.queryOptions({ input: {} }));
  return { metrics: query.data, isLoading: query.isPending };
}

export function useReviewBookItem() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.reviewItem.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSendBook() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.send.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.sent ? "Book enviado à indústria" : "Envio desfeito",
        );
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

function useInvalidateBooks() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.book.list.key() });
    queryClient.invalidateQueries({ queryKey: orpc.book.getOne.key() });
  };
}

export function useCreateBook() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.create.mutationOptions({
      onSuccess: () => {
        toast.success("Book criado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteBook() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Book excluído");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useImportBookPhotos() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.importPhotos.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.added} foto(s) adicionada(s)`);
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useAddBookPage() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.addPage.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDuplicateBookPage() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.duplicatePage.mutationOptions({
      onSuccess: () => {
        toast.success("Página duplicada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRemoveBookItem() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.removeItem.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useReorderBookItems() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.reorderItems.mutationOptions({
      onError: (error) => {
        toast.error(error.message);
        invalidate();
      },
    }),
  );
}

export function useGenerateBook() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.generate.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.status === "READY"
            ? "Book gerado com sucesso!"
            : "Gerando o book em PDF…",
        );
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// ── Capa / página final ──────────────────────────────────────────────────

export function useUpdateBookCoverLayout() {
  return useMutation(
    orpc.book.updateCoverLayout.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDefaultCoverTemplate() {
  const query = useQuery(
    orpc.book.getDefaultCoverTemplate.queryOptions({ input: {} }),
  );
  return {
    template: query.data as
      | {
          coverLayout: CoverElement[];
          closingLayout: CoverElement[];
          coverBackground: CoverBackground | null;
          closingBackground: CoverBackground | null;
        }
      | null
      | undefined,
    isLoading: query.isPending,
  };
}

export function useSetDefaultCoverTemplate() {
  return useMutation(
    orpc.book.setDefaultCoverTemplate.mutationOptions({
      onSuccess: () => toast.success("Definido como padrão da organização"),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateBookPageLayout() {
  return useMutation(
    orpc.book.updatePageLayout.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateBookItemLayout() {
  const invalidateBooks = useInvalidateBooks();
  return useMutation(
    orpc.book.updateItemLayout.mutationOptions({
      onSuccess: () => invalidateBooks(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Layout PRÓPRIO de UMA página (modelo novo, BookPage) — usado pelo "Editar
// layout" das páginas V2 (auto e manuais novas).
export function useUpdateBookPageOwnLayout() {
  const invalidateBooks = useInvalidateBooks();
  return useMutation(
    orpc.book.updateBookPageLayout.mutationOptions({
      onSuccess: () => invalidateBooks(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

// ── Padrões por indústria ────────────────────────────────────────────────

export function useBookTemplates(supplierId: string | null) {
  const query = useQuery(
    orpc.book.listTemplates.queryOptions({ input: { supplierId } }),
  );
  return { templates: query.data?.templates ?? [], isLoading: query.isPending };
}

export function useTemplateForBook(supplierId: string | null) {
  const query = useQuery(
    orpc.book.getTemplateForBook.queryOptions({ input: { supplierId } }),
  );
  return {
    template: query.data,
    isLoading: query.isPending,
    error: query.error,
  };
}

function useInvalidateTemplates() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.book.listTemplates.key() });
    queryClient.invalidateQueries({
      queryKey: orpc.book.getTemplateForBook.key(),
    });
  };
}

export function useSaveBookTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation(
    orpc.book.saveTemplate.mutationOptions({
      onSuccess: (result) => {
        toast.success(`Padrão "${result.name}" salvo`);
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteBookTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation(
    orpc.book.deleteTemplate.mutationOptions({
      onSuccess: () => {
        toast.success("Padrão excluído");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useApplyBookTemplate() {
  const invalidateBooks = useInvalidateBooks();
  return useMutation(
    orpc.book.applyTemplate.mutationOptions({
      onSuccess: () => {
        toast.success("Padrão aplicado ao book");
        invalidateBooks();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// ── Padrões de página ────────────────────────────────────────────────────

export function useBookPageTemplates(supplierId: string | null) {
  const query = useQuery(
    orpc.book.listPageTemplates.queryOptions({ input: { supplierId } }),
  );
  return { templates: query.data?.templates ?? [], isLoading: query.isPending };
}

function useInvalidatePageTemplates() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.book.listPageTemplates.key(),
    });
  };
}

export function useSaveBookPageTemplate() {
  const invalidate = useInvalidatePageTemplates();
  return useMutation(
    orpc.book.savePageTemplate.mutationOptions({
      onSuccess: (result) => {
        toast.success(`Padrão de página "${result.name}" salvo`);
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteBookPageTemplate() {
  const invalidate = useInvalidatePageTemplates();
  return useMutation(
    orpc.book.deletePageTemplate.mutationOptions({
      onSuccess: () => {
        toast.success("Padrão de página excluído");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useApplyBookPageTemplate() {
  const invalidateBooks = useInvalidateBooks();
  return useMutation(
    orpc.book.applyPageTemplate.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.cleared
            ? "Página voltou a seguir o layout do book"
            : "Padrão aplicado à página",
        );
        invalidateBooks();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSupplierBrands(supplierId: string | null) {
  const query = useQuery({
    ...orpc.book.listSupplierBrands.queryOptions({
      input: { supplierId: supplierId ?? "" },
    }),
    enabled: !!supplierId,
  });
  return { brands: query.data?.brands ?? [], isLoading: query.isPending };
}

export function useUploadCoverImage() {
  return useMutation({
    mutationFn: (file: File) => uploadToR2(file, true),
    onError: () => toast.error("Falha ao enviar imagem"),
  });
}

// ── Auto-geração + padrões auto-N ────────────────────────────────────────

export function useAutoGeneratePreview(input: {
  supplierId: string | null;
  periodMonth: number;
  periodYear: number;
}) {
  const query = useQuery({
    ...orpc.book.autoGeneratePreview.queryOptions({
      input: {
        supplierId: input.supplierId ?? "",
        periodMonth: input.periodMonth,
        periodYear: input.periodYear,
      },
    }),
    enabled: !!input.supplierId,
  });
  return { preview: query.data, isLoading: query.isPending };
}

export function useAutoGenerateBook() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.autoGenerate.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `Book gerado: ${result.storesCount} loja(s) · ${result.pagesCount} página(s) · ${result.photosCount} foto(s).`,
        );
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSetSlotPhoto() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.setSlotPhoto.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSetSlotAdjustment() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.setSlotAdjustment.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function usePageTemplate(id: string) {
  const query = useQuery({
    ...orpc.book.getPageTemplate.queryOptions({ input: { id } }),
    enabled: !!id,
  });
  return { template: query.data, isLoading: query.isPending };
}

export function useUpdatePageTemplate() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.book.updatePageTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.book.getPageTemplate.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.book.listIndustryTemplates.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useTemplateIndustries() {
  const query = useQuery(
    orpc.book.listTemplateIndustries.queryOptions({ input: {} }),
  );
  return {
    industries: query.data?.industries ?? [],
    isLoading: query.isPending,
  };
}

export function useIndustryTemplates(supplierId: string) {
  const query = useQuery({
    ...orpc.book.listIndustryTemplates.queryOptions({ input: { supplierId } }),
    enabled: !!supplierId,
  });
  return { data: query.data, isLoading: query.isPending };
}

export function useCreateIndustryTemplate() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.book.createIndustryTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.book.listIndustryTemplates.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.book.listTemplateIndustries.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useCreateIndustryBase() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.book.createIndustryBase.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.book.listIndustryTemplates.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useReapplyIndustryBase() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.book.reapplyIndustryBase.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.updated === 0
            ? "Nenhuma página de fotos para atualizar"
            : `${result.updated} página(s) de fotos atualizada(s) com o padrão base`,
        );
        queryClient.invalidateQueries({
          queryKey: orpc.book.listIndustryTemplates.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useAddBookExtraPage() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.addExtraPage.mutationOptions({
      onSuccess: () => {
        toast.success("Página extra adicionada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useReorderBookPages() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.reorderPages.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => {
        toast.error(error.message);
        invalidate();
      },
    }),
  );
}

export function useDeleteBookPage() {
  const invalidate = useInvalidateBooks();
  return useMutation(
    orpc.book.deletePage.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}
