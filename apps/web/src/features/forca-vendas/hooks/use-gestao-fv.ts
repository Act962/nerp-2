"use client";

import { orpc } from "@/lib/orpc";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { StatusFiltroPedido } from "./use-forca-vendas";

function erro(error: Error) {
  toast.error(error.message);
}

const g = orpc.forcaVendasGestao;

// ── Pedidos (receptor) ──────────────────────────────────────────────────────

export function usePedidosGestao(args: {
  status: StatusFiltroPedido | null;
  memberId: string | null;
}) {
  return useInfiniteQuery(
    g.pedidos.listar.infiniteOptions({
      input: (cursor: string | null) => ({
        status: args.status,
        memberId: args.memberId,
        cursor,
        limite: 30,
      }),
      initialPageParam: null as string | null,
      getNextPageParam: (pagina) => pagina.proximoCursor,
      placeholderData: keepPreviousData,
      refetchInterval: 60_000,
    }),
  );
}

export function usePedidoGestao(saleId: string | null) {
  return useQuery({
    ...g.pedidos.detalhe.queryOptions({ input: { saleId: saleId ?? "" } }),
    enabled: Boolean(saleId),
  });
}

function useInvalidarPedidosGestao() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: g.pedidos.key() });
    queryClient.invalidateQueries({ queryKey: g.vendedores.key() });
  };
}

export function useDecidirPedidoGestao() {
  const invalidar = useInvalidarPedidosGestao();
  return useMutation(
    g.pedidos.decidir.mutationOptions({
      onSuccess: (_, variaveis) => {
        invalidar();
        toast.success(
          variaveis.aprovar ? "Pedido aprovado" : "Pedido recusado",
        );
      },
      onError: erro,
    }),
  );
}

export function useFaturarPedidoGestao() {
  const invalidar = useInvalidarPedidosGestao();
  return useMutation(
    g.pedidos.faturar.mutationOptions({
      onSuccess: () => {
        invalidar();
        toast.success("Pedido faturado: estoque, títulos e flex lançados");
      },
      onError: erro,
    }),
  );
}

export function useCancelarPedidoGestao() {
  const invalidar = useInvalidarPedidosGestao();
  return useMutation(
    g.pedidos.cancelar.mutationOptions({
      onSuccess: () => {
        invalidar();
        toast.success("Pedido cancelado");
      },
      onError: erro,
    }),
  );
}

// ── Vendedores ──────────────────────────────────────────────────────────────

export function useVendedoresGestao() {
  return useQuery(g.vendedores.listar.queryOptions({ input: {} }));
}

export function useAtualizarVendedorGestao() {
  const queryClient = useQueryClient();
  return useMutation(
    g.vendedores.atualizar.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: g.vendedores.key() });
        toast.success("Vendedor atualizado");
      },
      onError: erro,
    }),
  );
}

export function useAjustarFlexGestao() {
  const queryClient = useQueryClient();
  return useMutation(
    g.vendedores.ajustarFlex.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: g.vendedores.key() });
        toast.success("Flex ajustado");
      },
      onError: erro,
    }),
  );
}

export function useExtratoFlexGestao(memberId: string | null) {
  return useQuery({
    ...g.vendedores.extratoFlex.queryOptions({
      input: { memberId: memberId ?? "" },
    }),
    enabled: Boolean(memberId),
  });
}

// ── Carteiras ───────────────────────────────────────────────────────────────

export function useClientesDaCarteiraGestao(args: {
  memberId: string | null;
  busca: string;
  cidade: string | null;
  situacao: "DA_CARTEIRA" | "SEM_CARTEIRA" | "TODOS";
}) {
  return useInfiniteQuery({
    ...g.carteiras.clientes.infiniteOptions({
      input: (cursor: string | null) => ({
        memberId: args.memberId ?? "",
        busca: args.busca,
        cidade: args.cidade,
        situacao: args.situacao,
        cursor,
        limite: 50,
      }),
      initialPageParam: null as string | null,
      getNextPageParam: (pagina) => pagina.proximoCursor,
      placeholderData: keepPreviousData,
    }),
    enabled: Boolean(args.memberId),
  });
}

export function useCidadesGestao() {
  return useQuery(g.carteiras.cidades.queryOptions({ input: {} }));
}

function useInvalidarCarteiras() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: g.carteiras.key() });
    queryClient.invalidateQueries({ queryKey: g.vendedores.key() });
  };
}

export function useAtribuirCarteiraGestao() {
  const invalidar = useInvalidarCarteiras();
  return useMutation(
    g.carteiras.atribuir.mutationOptions({
      onSuccess: (resultado) => {
        invalidar();
        toast.success(
          resultado.adicionados === 1
            ? "1 cliente adicionado à carteira"
            : `${resultado.adicionados} clientes adicionados à carteira`,
        );
      },
      onError: erro,
    }),
  );
}

export function useRemoverDaCarteiraGestao() {
  const invalidar = useInvalidarCarteiras();
  return useMutation(
    g.carteiras.remover.mutationOptions({
      onSuccess: (resultado) => {
        invalidar();
        toast.success(`${resultado.removidos} cliente(s) saíram da carteira`);
      },
      onError: erro,
    }),
  );
}

// ── Mapa e visitas ──────────────────────────────────────────────────────────

export function useMapaGestao() {
  return useQuery({
    ...g.mapa.aoVivo.queryOptions({ input: {} }),
    refetchInterval: 30_000,
  });
}

export function useTrajetoGestao(memberId: string | null, dia: string) {
  return useQuery({
    ...g.mapa.trajeto.queryOptions({
      input: { memberId: memberId ?? "", dia },
    }),
    enabled: Boolean(memberId),
  });
}

export function useResumoVisitasGestao(dia: string) {
  return useQuery(g.visitas.resumo.queryOptions({ input: { dia } }));
}

// ── Avisos ──────────────────────────────────────────────────────────────────

export function useAvisosGestao() {
  return useQuery(g.avisos.listar.queryOptions({ input: {} }));
}

export function usePublicarAvisoGestao() {
  const queryClient = useQueryClient();
  return useMutation(
    g.avisos.publicar.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: g.avisos.key() });
        toast.success("Aviso publicado");
      },
      onError: erro,
    }),
  );
}

export function useEncerrarAvisoGestao() {
  const queryClient = useQueryClient();
  return useMutation(
    g.avisos.encerrar.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: g.avisos.key() });
        toast.success("Aviso tirado do ar");
      },
      onError: erro,
    }),
  );
}

// ── Política comercial e condições ──────────────────────────────────────────

export function useConfiguracaoGestao() {
  return useQuery(g.configuracao.obter.queryOptions({ input: {} }));
}

export function useSalvarConfiguracaoGestao() {
  const queryClient = useQueryClient();
  return useMutation(
    g.configuracao.salvar.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: g.configuracao.key() });
        toast.success("Política comercial salva");
      },
      onError: erro,
    }),
  );
}

export function useCondicoesGestao() {
  return useQuery(g.condicoes.listar.queryOptions({ input: {} }));
}

export function useSalvarCondicaoGestao() {
  const queryClient = useQueryClient();
  return useMutation(
    g.condicoes.salvar.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: g.condicoes.key() });
        queryClient.invalidateQueries({
          queryKey: orpc.forcaVendas.pedidos.condicoes.key(),
        });
        toast.success("Condição salva");
      },
      onError: erro,
    }),
  );
}
