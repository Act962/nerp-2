"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useMapStores() {
  const query = useQuery(orpc.fieldMap.stores.queryOptions({ input: {} }));
  return {
    stores: query.data?.stores ?? [],
    offMap: query.data?.offMap ?? [],
    canSeeAll: query.data?.canSeeAll ?? false,
    isLoading: query.isPending,
  };
}

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Varejo conhecido, igual para toda organização — não é carteira de ninguém.
 *
 * Recortado pela área visível: o catálogo cresce a cada varredura, e sem o
 * recorte o mapa passaria a mostrar um punhado arbitrário de pontos do país
 * inteiro — sintoma que só aparece depois, quando já parece aleatório.
 */
export function useDirectoryStores(bounds: MapBounds | null) {
  const query = useQuery(
    orpc.fieldMap.directoryStores.queryOptions({
      input: bounds ?? {},
      // Sem isto os pinos SOMEM a cada movimento do mapa: a área faz parte da
      // chave, e chave nova começa sem dado até a resposta chegar. Segurar o
      // conjunto anterior troca "pisca e volta" por "atualiza no lugar".
      placeholderData: (previousData) => previousData,
    }),
  );
  return {
    points: query.data?.points ?? [],
    isLoading: query.isPending,
  };
}

export function useMapPromoters() {
  const query = useQuery(orpc.fieldMap.promoters.queryOptions({ input: {} }));
  return {
    promoters: query.data?.promoters ?? [],
    canSeeAll: query.data?.canSeeAll ?? false,
    isLoading: query.isPending,
  };
}

/**
 * Sugestão de lojas enquanto digita.
 *
 * Pode consultar a cada tecla porque bate no banco da própria organização — a
 * proibição de autocomplete vale para o Nominatim, que continua atrás do Enter
 * em `useSearchPlaces`. Misturar os dois estouraria a cota que o geocode de
 * toda captura de foto usa em produção.
 */
export function useStoreSuggestions(
  query: string,
  origin: {
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
  },
) {
  const term = query.trim();
  const query$ = useQuery(
    orpc.fieldMap.searchStores.queryOptions({
      input: { query: term, ...origin },
      enabled: term.length >= 2,
      // Sem isto a lista pisca em branco a cada tecla, porque o termo faz parte
      // da chave e chave nova começa sem dado.
      placeholderData: (previousData) => previousData,
    }),
  );
  return {
    results: term.length >= 2 ? (query$.data?.results ?? []) : [],
    isLoading: query$.isFetching && term.length >= 2,
  };
}

/**
 * Onde a equipe foi vista por último — sem relação com o período do filtro.
 *
 * `enabled` fica a cargo de quem chama: a consulta só sai quando a camada está
 * ligada, senão toda visita ao mapa paga por um dado que ninguém pediu.
 */
export function usePromoterPositions(enabled: boolean) {
  const query = useQuery(
    orpc.fieldMap.promoterPositions.queryOptions({ input: {}, enabled }),
  );
  return {
    positions: query.data?.positions ?? [],
    isLoading: query.isPending && enabled,
  };
}

export function useFieldTrail(
  range: { from: string; to: string },
  memberIds?: string[],
) {
  const query = useQuery(
    orpc.fieldMap.trail.queryOptions({
      input: { ...range, memberIds: memberIds?.length ? memberIds : undefined },
    }),
  );
  return {
    trails: query.data?.trails ?? [],
    truncated: query.data?.truncated ?? false,
    canSeeAll: query.data?.canSeeAll ?? false,
    isLoading: query.isPending,
  };
}

/** O cadastro de clientes muda /lojas, o wizard do promotor e o calendário. */
function invalidateStores(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: orpc.fieldMap.stores.key() });
  queryClient.invalidateQueries({ queryKey: orpc.store.list.key() });
}

export function useCreateStoreAtPoint() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.fieldMap.createStoreAt.mutationOptions({
      onSuccess: () => {
        toast.success("Cliente cadastrado no mapa");
        invalidateStores(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/**
 * Busca no OpenStreetMap. É mutation, não query, de propósito: nada pode
 * disparar sozinho ao abrir a tela — a política do Overpass proíbe uso em massa
 * e o refetch automático do React Query seria exatamente isso.
 */
export function useSearchOsmStores() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.fieldMap.searchOsm.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.found === 0
            ? "Nenhum supermercado mapeado nesta área"
            : `${result.found} supermercado(s) na área · ${result.added} novo(s) no catálogo`,
        );
        queryClient.invalidateQueries({
          queryKey: orpc.fieldMap.directoryStores.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/**
 * Busca por nome no mapa. Mutation porque a política do Nominatim proíbe
 * autocomplete a cada tecla — só dispara no Enter ou no clique.
 */
export function useSearchPlaces() {
  return useMutation(
    orpc.fieldMap.searchPlaces.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useImportOsmStores() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.fieldMap.importOsm.mutationOptions({
      onSuccess: (result) => {
        const parts = [
          result.created > 0 ? `${result.created} cliente(s) criado(s)` : null,
          result.linked > 0
            ? `${result.linked} vinculado(s) a cadastro existente`
            : null,
          result.skipped > 0 ? `${result.skipped} ignorado(s)` : null,
        ].filter(Boolean);
        toast.success(parts.join(" · ") || "Nada a importar");
        invalidateStores(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/** Varejo GLOBAL: a troca aparece no mapa de todas as empresas. */
export function useSetDirectoryLogo() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.fieldMap.setDirectoryLogo.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.scope === "COMPANY"
            ? `Logo aplicada a ${result.affected} ponto(s) da rede`
            : "Logo atualizada neste ponto",
        );
        queryClient.invalidateQueries({
          queryKey: orpc.fieldMap.directoryStores.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSetStoreLogo() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.fieldMap.setStoreLogo.mutationOptions({
      onSuccess: () => {
        toast.success("Logo atualizada");
        invalidateStores(queryClient);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
