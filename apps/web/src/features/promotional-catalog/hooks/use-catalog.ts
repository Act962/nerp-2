"use client";

import { useState } from "react";
import { orpc } from "@/lib/orpc";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function usePromotionalCatalogs() {
  return useQuery(orpc.promotionalCatalog.list.queryOptions({ input: {} }));
}

// Miniaturas em query SEPARADA: a lista aparece na hora e as miniaturas (data
// URL pesada) preenchem os cards em segundo plano.
export function useCatalogThumbnails() {
  return useQuery({
    ...orpc.promotionalCatalog.catalogThumbnails.queryOptions({ input: {} }),
    // As miniaturas são data URLs (~30 KB cada) e vêm todas num payload só.
    // Sem cache, cada volta para a lista rebaixava tudo de novo — é o que
    // fazia a grade demorar a preencher. A prévia muda pouco; 5 min basta.
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

// ── Padrões (presets de estilo) ──────────────────────────────────────────
export function useCatalogTemplates() {
  return useQuery(
    orpc.promotionalCatalog.listTemplates.queryOptions({ input: {} }),
  );
}

export function useCreateCatalogTemplate() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotionalCatalog.createTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listTemplates.key(),
        });
        toast.success("Padrão salvo");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateCatalogTemplate() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotionalCatalog.updateTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listTemplates.key(),
        });
        toast.success("Padrão atualizado");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// ── Estilos de preço (biblioteca "Estilos": meus + do sistema) ────────────
export function usePriceStyles() {
  return useQuery(
    orpc.promotionalCatalog.listPriceStyles.queryOptions({ input: {} }),
  );
}

export function useCreatePriceStyle() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotionalCatalog.createPriceStyle.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listPriceStyles.key(),
        });
        toast.success("Estilo salvo");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdatePriceStyle() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotionalCatalog.updatePriceStyle.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listPriceStyles.key(),
        });
        toast.success("Estilo atualizado");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeletePriceStyle() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotionalCatalog.deletePriceStyle.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listPriceStyles.key(),
        });
        toast.success("Estilo excluído");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteCatalogTemplate() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotionalCatalog.deleteTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listTemplates.key(),
        });
        toast.success("Padrão excluído");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function usePromotionalCatalog(id: string) {
  return useQuery(orpc.promotionalCatalog.get.queryOptions({ input: { id } }));
}

export function useCreateCatalog() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation(
    orpc.promotionalCatalog.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.list.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.catalogThumbnails.key(),
        });
        router.push(`/catalogo-promocional/${data.id}`);
      },
      onError: () => {
        toast.error("Erro ao criar catálogo");
      },
    }),
  );
}

export function useUpdateCatalog() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.promotionalCatalog.update.mutationOptions({
      onSuccess: () => {
        // Só a lista (nome/miniatura no grid). NÃO invalida `get` nem
        // `listProducts`: no editor isso dispararia um refetch que sobrescreve
        // a config local em edição (fonte da verdade é o cliente).
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.list.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.catalogThumbnails.key(),
        });
      },
    }),
  );
}

// Autosave do editor: salva em background, sem invalidar nada e sem toast. Como
// o cliente é dono da config enquanto edita, nenhum refetch pode sobrescrever as
// alterações em andamento — várias mudanças seguidas coalescem num único save.
export function useAutosaveCatalog() {
  return useMutation(orpc.promotionalCatalog.update.mutationOptions());
}

export function useDeleteCatalog() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.promotionalCatalog.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.list.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.catalogThumbnails.key(),
        });
        toast.success("Catálogo excluído");
      },
      onError: () => {
        toast.error("Erro ao excluir catálogo");
      },
    }),
  );
}

// Duplica o catálogo no servidor (copia config + miniatura) e abre a cópia.
export function useDuplicateCatalog() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation(
    orpc.promotionalCatalog.duplicate.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.list.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.catalogThumbnails.key(),
        });
        toast.success("Catálogo duplicado");
        router.push(`/catalogo-promocional/${data.id}`);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// ── Etiquetas (biblioteca de PNGs) ────────────────────────────────────────
export function useCatalogAssets() {
  return useQuery(
    orpc.promotionalCatalog.listAssets.queryOptions({ input: {} }),
  );
}

// Envia o PNG ao R2 (uploadToR2) e registra na biblioteca da organização.
export function useCreateCatalogAsset() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const mutation = useMutation(
    orpc.promotionalCatalog.createAsset.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listAssets.key(),
        });
        toast.success("Etiqueta adicionada");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const key = await uploadToR2(file, true);
      await mutation.mutateAsync({
        name: file.name.replace(/\.[^.]+$/, ""),
        key,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao enviar a etiqueta",
      );
    } finally {
      setUploading(false);
    }
  };

  return { upload, isPending: uploading || mutation.isPending };
}

// ── App Vendedor: catálogos read-only + badge "não vistos" ────────────────
export function useSellerCatalogs() {
  return useQuery(
    orpc.promotionalCatalog.listForSeller.queryOptions({ input: {} }),
  );
}

export function useUnseenCatalogCount(enabled = true) {
  return useQuery(
    orpc.promotionalCatalog.unseenCount.queryOptions({ input: {}, enabled }),
  );
}

// Marca um catálogo como aberto pelo vendedor (zera o badge). Invalida a lista
// e a contagem para o número atualizar na hora.
export function useMarkCatalogViewed() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotionalCatalog.markViewed.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listForSeller.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.unseenCount.key(),
        });
      },
    }),
  );
}

export function useDeleteCatalogAsset() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotionalCatalog.deleteAsset.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listAssets.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateProductPrice() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotionalCatalog.updateProductPrice.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listProducts.key(),
        });
      },
      onError: () => {
        toast.error("Erro ao salvar preço promocional");
      },
    }),
  );
}

// Troca a foto do produto NO BANCO: sobe o arquivo pro R2 e grava a nova
// thumbnail. Altera o produto de verdade (reflete no catálogo e em todo lugar
// que usa o produto). Invalida a lista pro card atualizar na hora.
export function useSetProductThumbnail() {
  const queryClient = useQueryClient();
  const mutation = useMutation(
    orpc.products.setThumbnail.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listProducts.key(),
        });
        toast.success("Foto do produto atualizada");
      },
      onError: () => {
        toast.error("Erro ao atualizar a foto do produto");
      },
    }),
  );

  const upload = async (
    productId: string,
    file: File,
    opts?: { onSuccess?: () => void },
  ): Promise<string | undefined> => {
    try {
      const key = await uploadToR2(file);
      await mutation.mutateAsync({ productId, key });
      opts?.onSuccess?.();
      return key;
    } catch {
      toast.error("Falha ao enviar a imagem");
      return undefined;
    }
  };

  return { upload, isPending: mutation.isPending };
}

// Busca imagens reais do produto na web (IA). Retorna URLs candidatas.
export function useSearchProductImages() {
  return useMutation(
    orpc.products.searchImages.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Baixa a imagem da URL escolhida e grava como thumbnail no banco.
export function useSetProductThumbnailFromUrl() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.products.setThumbnailFromUrl.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listProducts.key(),
        });
        toast.success("Foto do produto atualizada");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Remove o fundo da foto do produto (motor do planograma) e grava no cadastro.
// Se o fundo não for uniforme, avisa e mantém a foto original.
export function useRemoveProductBackground() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.products.removeBackground.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listProducts.key(),
        });
        if (data.applied) {
          toast.success("Fundo removido");
        } else {
          toast.warning(
            data.reason ??
              "Fundo não uniforme — a foto original foi mantida. Use outra imagem.",
          );
        }
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Define a unidade de venda NO CADASTRO (produto real). Invalida a lista pro
// card refletir na hora.
export function useSetProductUnit() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.products.setUnit.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listProducts.key(),
        });
      },
      onError: () => {
        toast.error("Erro ao atualizar a unidade");
      },
    }),
  );
}

// excludedIds e sortBy são intencionalmente omitidos do input da query:
// o filtro/ordenação fica no cliente via useMemo para evitar refetch a cada
// mudança e garantir UI otimista sem reset.
export function usePromotionalProducts(input: {
  manuallyAddedIds?: string[];
  categoryFilter?: string[];
  autoPromotions?: boolean;
  name?: string;
}) {
  return useQuery(orpc.promotionalCatalog.listProducts.queryOptions({ input }));
}

// Ativa o link público do catálogo (gera/retorna o token do link).
export function useEnableCatalogShare() {
  return useMutation(orpc.promotionalCatalog.enableShare.mutationOptions());
}

// Desativa o link público (o link vira 404).
export function useDisableCatalogShare() {
  return useMutation(orpc.promotionalCatalog.disableShare.mutationOptions());
}

// Casa nomes de produtos (aba "Lista") com o cadastro, para trazer imagens.
export function useMatchProductsByName() {
  return useMutation(
    orpc.promotionalCatalog.matchProductsByName.mutationOptions(),
  );
}

// Extrai ofertas de um PDF/imagem via IA (Gemini) — aba "Lista".
export function useExtractOffersFromFile() {
  return useMutation(
    orpc.promotionalCatalog.extractOffersFromFile.mutationOptions(),
  );
}

// Busca de produtos para o typeahead da aba "Lista".
export function useSearchCatalogProducts(q: string, enabled: boolean) {
  return useQuery(
    orpc.promotionalCatalog.searchProducts.queryOptions({
      input: { q },
      enabled: enabled && q.trim().length >= 2,
    }),
  );
}

// Cria em lote os produtos novos escolhidos no wizard da aba "Lista".
export function useCreateOfferProducts() {
  return useMutation(
    orpc.promotionalCatalog.createOfferProducts.mutationOptions(),
  );
}

// Casa nomes de clientes com lojas (Store) — wizard da aba "Lista".
export function useMatchStoresByName() {
  return useMutation(
    orpc.promotionalCatalog.matchStoresByName.mutationOptions(),
  );
}

// Fotos atuais (thumbnail) do cadastro por id — a aba "Lista" usa para
// reconciliar a foto das linhas casadas com o banco.
export function useProductThumbnails(ids: string[]) {
  return useQuery({
    ...orpc.promotionalCatalog.productThumbnails.queryOptions({
      input: { ids },
    }),
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
}
