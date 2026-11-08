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

function erro(error: Error) {
  toast.error(error.message);
}

// ── Home ────────────────────────────────────────────────────────────────────

export function useInicioFv() {
  return useQuery({
    ...orpc.forcaVendas.inicio.dados.queryOptions({ input: {} }),
    // A home é o "painel" do vendedor: volta a buscar quando ele retorna a ela.
    refetchOnWindowFocus: true,
  });
}

export function useNaoLidasFv() {
  return useQuery({
    ...orpc.forcaVendas.mensagens.naoLidas.queryOptions({ input: {} }),
    refetchInterval: 60_000,
  });
}

// ── Clientes ────────────────────────────────────────────────────────────────

export function useCarteiraFv(busca: string) {
  return useInfiniteQuery(
    orpc.forcaVendas.clientes.listar.infiniteOptions({
      input: (cursor: string | null) => ({ busca, cursor, limite: 20 }),
      initialPageParam: null as string | null,
      getNextPageParam: (pagina) => pagina.proximoCursor,
      placeholderData: keepPreviousData,
    }),
  );
}

export function useClienteFv(customerId: string) {
  return useQuery(
    orpc.forcaVendas.clientes.detalhe.queryOptions({ input: { customerId } }),
  );
}

export function useConversaDoClienteFv(customerId: string) {
  return useQuery(
    orpc.forcaVendas.clientes.conversa.queryOptions({ input: { customerId } }),
  );
}

// ── Produtos ────────────────────────────────────────────────────────────────

export function useProdutosFv(args: {
  busca: string;
  customerId: string | null;
  apenasOfertas?: boolean;
}) {
  return useInfiniteQuery(
    orpc.forcaVendas.produtos.buscar.infiniteOptions({
      input: (cursor: string | null) => ({
        busca: args.busca,
        customerId: args.customerId,
        apenasOfertas: args.apenasOfertas ?? false,
        cursor,
        limite: 20,
      }),
      initialPageParam: null as string | null,
      getNextPageParam: (pagina) => pagina.proximoCursor,
      placeholderData: keepPreviousData,
    }),
  );
}

export function useProdutoFv(
  productId: string,
  customerId: string | null,
  enabled = true,
) {
  return useQuery({
    ...orpc.forcaVendas.produtos.detalhe.queryOptions({
      input: { productId, customerId },
    }),
    enabled: enabled && Boolean(productId),
  });
}

// ── Pedidos ─────────────────────────────────────────────────────────────────

export type StatusFiltroPedido =
  | "ABERTOS"
  | "PENDING_APPROVAL"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "DRAFT";

export function usePedidosFv(args: {
  status: StatusFiltroPedido | null;
  customerId?: string | null;
  apenasMeus?: boolean;
}) {
  return useInfiniteQuery(
    orpc.forcaVendas.pedidos.listar.infiniteOptions({
      input: (cursor: string | null) => ({
        status: args.status,
        customerId: args.customerId ?? null,
        apenasMeus: args.apenasMeus ?? true,
        cursor,
        limite: 20,
      }),
      initialPageParam: null as string | null,
      getNextPageParam: (pagina) => pagina.proximoCursor,
    }),
  );
}

export function usePedidoFv(saleId: string) {
  return useQuery(
    orpc.forcaVendas.pedidos.detalhe.queryOptions({ input: { saleId } }),
  );
}

export function useCondicoesFv() {
  return useQuery(
    orpc.forcaVendas.pedidos.condicoes.queryOptions({ input: {} }),
  );
}

export function useSimularPedidoFv() {
  return useMutation(orpc.forcaVendas.pedidos.simular.mutationOptions());
}

function useInvalidarPedidos() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.forcaVendas.pedidos.key() });
    queryClient.invalidateQueries({ queryKey: orpc.forcaVendas.inicio.key() });
    queryClient.invalidateQueries({
      queryKey: orpc.forcaVendas.produtos.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.forcaVendas.clientes.key(),
    });
  };
}

export function useEnviarPedidoFv() {
  const invalidar = useInvalidarPedidos();
  return useMutation(
    orpc.forcaVendas.pedidos.enviar.mutationOptions({
      onSuccess: (resultado) => {
        invalidar();
        if (resultado.status === "CONFIRMED") {
          toast.success(`Pedido #${resultado.numero} confirmado`);
        } else if (resultado.status === "DRAFT") {
          toast.success(`Orçamento #${resultado.numero} salvo`);
        } else {
          toast.info(`Pedido #${resultado.numero} foi para aprovação`);
        }
      },
      onError: erro,
    }),
  );
}

export function useCancelarPedidoFv() {
  const invalidar = useInvalidarPedidos();
  return useMutation(
    orpc.forcaVendas.pedidos.cancelar.mutationOptions({
      onSuccess: () => {
        invalidar();
        toast.success("Pedido cancelado");
      },
      onError: erro,
    }),
  );
}

export function useEnviarOrcamentoFv() {
  const invalidar = useInvalidarPedidos();
  return useMutation(
    orpc.forcaVendas.pedidos.enviarOrcamento.mutationOptions({
      onSuccess: (resultado) => {
        invalidar();
        toast.success(
          resultado.status === "CONFIRMED"
            ? "Orçamento virou pedido confirmado"
            : "Orçamento virou pedido e foi para aprovação",
        );
      },
      onError: erro,
    }),
  );
}

export function useDecidirPedidoFv() {
  const invalidar = useInvalidarPedidos();
  return useMutation(
    orpc.forcaVendas.pedidos.decidir.mutationOptions({
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

// ── Consultas ───────────────────────────────────────────────────────────────

export function useTitulosFv() {
  return useQuery(
    orpc.forcaVendas.consultas.titulos.queryOptions({ input: {} }),
  );
}

export function useExtratoFlexFv() {
  return useQuery(
    orpc.forcaVendas.consultas.extratoFlex.queryOptions({ input: {} }),
  );
}

// ── Rota, visita e jornada ──────────────────────────────────────────────────

export function useRoteiroFv(diaSemana: number) {
  return useQuery(
    orpc.forcaVendas.rota.dia.queryOptions({ input: { diaSemana } }),
  );
}

function useInvalidarRota() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.forcaVendas.rota.key() });
    queryClient.invalidateQueries({ queryKey: orpc.forcaVendas.visitas.key() });
  };
}

export function useAdicionarAoRoteiroFv() {
  const invalidar = useInvalidarRota();
  return useMutation(
    orpc.forcaVendas.rota.adicionar.mutationOptions({
      onSuccess: () => {
        invalidar();
        toast.success("Cliente adicionado ao roteiro");
      },
      onError: erro,
    }),
  );
}

export function useRemoverDoRoteiroFv() {
  const invalidar = useInvalidarRota();
  return useMutation(
    orpc.forcaVendas.rota.remover.mutationOptions({
      onSuccess: invalidar,
      onError: erro,
    }),
  );
}

export function useReordenarRoteiroFv() {
  const invalidar = useInvalidarRota();
  return useMutation(
    orpc.forcaVendas.rota.reordenar.mutationOptions({
      onSuccess: invalidar,
      onError: erro,
    }),
  );
}

export function useOtimizarRoteiroFv() {
  const invalidar = useInvalidarRota();
  return useMutation(
    orpc.forcaVendas.rota.otimizar.mutationOptions({
      onSuccess: (resultado) => {
        invalidar();
        const km = (metros: number) => `${(metros / 1000).toFixed(1)} km`;
        toast.success(
          `Rota reorganizada: ${km(resultado.antesMetros)} → ${km(resultado.depoisMetros)}`,
        );
      },
      onError: erro,
    }),
  );
}

export function useVisitaAbertaFv() {
  return useQuery(orpc.forcaVendas.visitas.aberta.queryOptions({ input: {} }));
}

export function useCheckinFv() {
  const invalidar = useInvalidarRota();
  return useMutation(
    orpc.forcaVendas.visitas.checkin.mutationOptions({
      onSuccess: () => {
        invalidar();
        toast.success("Check-in feito");
      },
      onError: erro,
    }),
  );
}

export function useCheckoutFv() {
  const invalidar = useInvalidarRota();
  return useMutation(
    orpc.forcaVendas.visitas.checkout.mutationOptions({
      onSuccess: () => {
        invalidar();
        toast.success("Visita encerrada");
      },
      onError: erro,
    }),
  );
}

export function useJornadaFv() {
  return useQuery(orpc.forcaVendas.jornada.estado.queryOptions({ input: {} }));
}

export function useIniciarJornadaFv() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.forcaVendas.jornada.iniciar.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: orpc.forcaVendas.jornada.key(),
        }),
      onError: erro,
    }),
  );
}

export function useEncerrarJornadaFv() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.forcaVendas.jornada.encerrar.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.forcaVendas.jornada.key(),
        });
        toast.success("Jornada encerrada");
      },
      onError: erro,
    }),
  );
}

export function useRegistrarLocalizacaoFv() {
  return useMutation(orpc.forcaVendas.localizacao.registrar.mutationOptions());
}

// ── Avisos ──────────────────────────────────────────────────────────────────

export function useAvisosFv() {
  return useQuery(orpc.forcaVendas.avisos.listar.queryOptions({ input: {} }));
}

export function useMarcarAvisoFv() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.forcaVendas.avisos.marcar.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.forcaVendas.avisos.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.forcaVendas.inicio.key(),
        });
      },
      onError: erro,
    }),
  );
}

// ── Mensagens ───────────────────────────────────────────────────────────────

export function useConversasFv(busca: string) {
  return useInfiniteQuery(
    orpc.forcaVendas.mensagens.conversas.infiniteOptions({
      input: (cursor: string | null) => ({ busca, cursor, limite: 20 }),
      initialPageParam: null as string | null,
      getNextPageParam: (pagina) => pagina.proximoCursor,
      refetchInterval: 30_000,
    }),
  );
}

export function useAbrirConversaFv(conversationId: string) {
  return useQuery(
    orpc.forcaVendas.mensagens.abrir.queryOptions({
      input: { conversationId },
    }),
  );
}
