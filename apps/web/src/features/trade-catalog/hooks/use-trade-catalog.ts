"use client";

import type { MediaKind } from "@/generated/prisma/enums";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ---------- Mídia ----------

export function useMediaTypes(params?: {
  kind?: MediaKind;
  includeInactive?: boolean;
}) {
  const { data, isPending } = useQuery(
    orpc.mediaType.list.queryOptions({ input: params ?? {} }),
  );
  return { mediaTypes: data?.items ?? [], isLoading: isPending };
}

function useInvalidate(key: readonly unknown[]) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: key });
}

// ---------- Semeadura dos catálogos padrão ----------

export function useEnsureTradeCatalogs() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.tradeCatalogSeed.ensure.mutationOptions({
      onSuccess: (result) => {
        if (result.total > 0) {
          toast.success(`${result.total} itens padrão adicionados`);
        } else {
          toast.info("Os catálogos padrão já estão completos");
        }
        queryClient.invalidateQueries({ queryKey: orpc.mediaType.list.key() });
        queryClient.invalidateQueries({
          queryKey: orpc.negotiationType.list.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.storeSector.list.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useCreateMediaType() {
  const invalidate = useInvalidate(orpc.mediaType.list.key());
  return useMutation(
    orpc.mediaType.create.mutationOptions({
      onSuccess: () => {
        toast.success("Mídia criada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateMediaType() {
  const invalidate = useInvalidate(orpc.mediaType.list.key());
  return useMutation(
    orpc.mediaType.update.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteMediaType() {
  const invalidate = useInvalidate(orpc.mediaType.list.key());
  return useMutation(
    orpc.mediaType.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Mídia excluída");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// ---------- Tipos de negociação ----------

export function useNegotiationTypes(params?: { includeInactive?: boolean }) {
  const { data, isPending } = useQuery(
    orpc.negotiationType.list.queryOptions({ input: params ?? {} }),
  );
  return { negotiationTypes: data?.items ?? [], isLoading: isPending };
}

export function useCreateNegotiationType() {
  const invalidate = useInvalidate(orpc.negotiationType.list.key());
  return useMutation(
    orpc.negotiationType.create.mutationOptions({
      onSuccess: () => {
        toast.success("Tipo de negociação criado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateNegotiationType() {
  const invalidate = useInvalidate(orpc.negotiationType.list.key());
  return useMutation(
    orpc.negotiationType.update.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteNegotiationType() {
  const invalidate = useInvalidate(orpc.negotiationType.list.key());
  return useMutation(
    orpc.negotiationType.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Tipo de negociação excluído");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// ---------- Setores ----------

export function useStoreSectors(params?: { includeInactive?: boolean }) {
  const { data, isPending } = useQuery(
    orpc.storeSector.list.queryOptions({ input: params ?? {} }),
  );
  return { storeSectors: data?.items ?? [], isLoading: isPending };
}

export function useCreateStoreSector() {
  const invalidate = useInvalidate(orpc.storeSector.list.key());
  return useMutation(
    orpc.storeSector.create.mutationOptions({
      onSuccess: () => {
        toast.success("Setor criado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateStoreSector() {
  const invalidate = useInvalidate(orpc.storeSector.list.key());
  return useMutation(
    orpc.storeSector.update.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteStoreSector() {
  const invalidate = useInvalidate(orpc.storeSector.list.key());
  return useMutation(
    orpc.storeSector.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Setor excluído");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
