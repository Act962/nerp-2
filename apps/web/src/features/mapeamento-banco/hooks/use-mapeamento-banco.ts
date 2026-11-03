"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import type { TabelaRef } from "../domain/estrutura";

// Estrutura de banco de ERP quase não muda e o servidor já guarda por 1h: sem
// `staleTime` alto, cada troca de aba refaria leitura no banco do cliente.
const ESTRUTURA_STALE_MS = 30 * 60_000;

export function useConexaoDoBanco() {
  return useQuery(
    orpc.mapeamentoBanco.conexao.queryOptions({
      input: {},
      staleTime: 5 * 60_000,
      retry: false,
    }),
  );
}

export function useTabelasDoBanco() {
  return useQuery(
    orpc.mapeamentoBanco.tabelas.queryOptions({
      input: {},
      staleTime: ESTRUTURA_STALE_MS,
      retry: false,
    }),
  );
}

export function useDescricaoDaTabela(tabela: TabelaRef | null) {
  return useQuery(
    orpc.mapeamentoBanco.descrever.queryOptions({
      input: { tabela: tabela ?? { schema: "_", nome: "_" } },
      enabled: tabela !== null,
      staleTime: ESTRUTURA_STALE_MS,
      retry: false,
    }),
  );
}

export function useDiagramaDoBanco(schema: string | null) {
  return useQuery(
    orpc.mapeamentoBanco.diagrama.queryOptions({
      input: { schema },
      staleTime: ESTRUTURA_STALE_MS,
      retry: false,
    }),
  );
}

export interface PedidoDeAmostraDaTela {
  tabela: TabelaRef;
  colunas?: string[];
  filtro: { coluna: string; valor: string } | null;
  ordem: { coluna: string; direcao: "asc" | "desc" } | null;
  pagina: number;
}

export function useAmostraDaTabela(pedido: PedidoDeAmostraDaTela | null) {
  return useQuery(
    orpc.mapeamentoBanco.amostra.queryOptions({
      input: pedido ?? { tabela: { schema: "_", nome: "_" }, pagina: 0 },
      enabled: pedido !== null,
      // Dado vivo do ERP, mas ninguém precisa dele ao segundo: evita reler a
      // mesma página a cada volta para a aba.
      staleTime: 60_000,
      placeholderData: keepPreviousData,
      retry: false,
    }),
  );
}

export function usePerfilDaColuna(
  pedido: { tabela: TabelaRef; coluna: string } | null,
) {
  return useQuery(
    orpc.mapeamentoBanco.perfilDaColuna.queryOptions({
      input: pedido ?? { tabela: { schema: "_", nome: "_" }, coluna: "_" },
      enabled: pedido !== null,
      // Perfil de amostra muda pouco; reabrir o mesmo não relê o ERP.
      staleTime: 10 * 60_000,
      retry: false,
    }),
  );
}

export function useAtualizarEstrutura() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.mapeamentoBanco.atualizarEstrutura.mutationOptions({
      onSuccess: () => {
        toast.success("Estrutura recarregada do banco");
        queryClient.invalidateQueries({ queryKey: orpc.mapeamentoBanco.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useEstadoDoMapeamento() {
  return useQuery(
    orpc.mapeamentoBanco.mapeamento.ler.queryOptions({
      input: {},
      staleTime: 5 * 60_000,
      retry: false,
    }),
  );
}

export function useSugerirMapeamento() {
  return useMutation(
    orpc.mapeamentoBanco.mapeamento.sugerir.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Sem toast: o resultado, inclusive a falha, aparece na própria área de teste.
export function useTestarMapeamento() {
  return useMutation(orpc.mapeamentoBanco.mapeamento.testar.mutationOptions());
}

export function useSalvarMapeamento() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.mapeamentoBanco.mapeamento.salvar.mutationOptions({
      onSuccess: () => {
        toast.success("Mapeamento salvo");
        queryClient.invalidateQueries({
          queryKey: orpc.mapeamentoBanco.mapeamento.ler.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.mapeamentoBanco.tabelas.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
