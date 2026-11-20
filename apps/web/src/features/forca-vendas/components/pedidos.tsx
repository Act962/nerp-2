"use client";

import { ChevronRight, MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type StatusFiltroPedido,
  useCancelarPedidoFv,
  useDecidirPedidoFv,
  useEnviarOrcamentoFv,
  usePedidoFv,
  usePedidosFv,
} from "../hooks/use-forca-vendas";
import { descreverPrazos } from "../lib/parcelas";
import { MOTIVO_LABEL, type MotivoAprovacao } from "../lib/regras-pedido";
import {
  formatarDataHora,
  formatarQuantidade,
  formatBRL,
  linkWhatsapp,
  TIPO_PEDIDO,
} from "../lib/formatar";
import { FvPagina, Linha, Secao, StatusPedidoBadge, Vazio } from "./fv-pagina";

const FILTROS: Array<{ valor: StatusFiltroPedido | null; rotulo: string }> = [
  { valor: "ABERTOS", rotulo: "Abertos" },
  { valor: "PENDING_APPROVAL", rotulo: "Em aprovação" },
  { valor: "CONFIRMED", rotulo: "Aprovados" },
  { valor: "COMPLETED", rotulo: "Faturados" },
  { valor: "CANCELLED", rotulo: "Cancelados" },
  { valor: null, rotulo: "Todos" },
];

export function ListaDePedidos() {
  const [status, setStatus] = useState<StatusFiltroPedido | null>("ABERTOS");
  const [apenasMeus, setApenasMeus] = useState(true);
  const consulta = usePedidosFv({ status, apenasMeus });
  const pedidos =
    consulta.data?.pages.flatMap((pagina) => pagina.pedidos) ?? [];

  return (
    <FvPagina
      titulo="Pedidos"
      acao={
        <Button size="sm" asChild>
          <Link href="/forca-de-vendas/pedidos/novo">
            <Plus className="size-4" />
            Novo
          </Link>
        </Button>
      }
    >
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTROS.map((filtro) => (
          <Button
            key={filtro.rotulo}
            size="sm"
            variant={status === filtro.valor ? "default" : "outline"}
            className="shrink-0 rounded-full"
            onClick={() => setStatus(filtro.valor)}
          >
            {filtro.rotulo}
          </Button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <label htmlFor="fv-apenas-meus">Só os meus pedidos</label>
        <Switch
          id="fv-apenas-meus"
          checked={apenasMeus}
          onCheckedChange={setApenasMeus}
        />
      </div>

      {consulta.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((linha) => (
            <Skeleton key={linha} className="h-20" />
          ))}
        </div>
      ) : pedidos.length === 0 ? (
        <Vazio>Nenhum pedido aqui.</Vazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {pedidos.map((pedido) => (
            <li key={pedido.saleId}>
              <Link
                href={`/forca-de-vendas/pedidos/${pedido.saleId}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">
                      #{pedido.numero}
                    </span>
                    <StatusPedidoBadge status={pedido.status} />
                    {pedido.tipo !== "VENDA" ? (
                      <Badge variant="outline">
                        {TIPO_PEDIDO[pedido.tipo]}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-sm">
                    {pedido.cliente?.nome ?? "Sem cliente"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatarDataHora(pedido.criadoEm)} · {pedido.itens} itens
                    {!apenasMeus && pedido.vendedor
                      ? ` · ${pedido.vendedor}`
                      : ""}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">
                  {formatBRL(pedido.total)}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {consulta.hasNextPage ? (
        <Button
          variant="outline"
          onClick={() => consulta.fetchNextPage()}
          disabled={consulta.isFetchingNextPage}
        >
          {consulta.isFetchingNextPage ? <Spinner /> : "Carregar mais"}
        </Button>
      ) : null}
    </FvPagina>
  );
}

export function MotivosDeAprovacao({ motivos }: { motivos: string[] }) {
  if (motivos.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <li className="font-semibold">Vai para aprovação:</li>
      {motivos.map((motivo) => (
        <li key={motivo}>
          • {MOTIVO_LABEL[motivo as MotivoAprovacao] ?? motivo}
        </li>
      ))}
    </ul>
  );
}

function textoParaWhatsapp(
  pedido: NonNullable<ReturnType<typeof usePedidoFv>["data"]>,
) {
  const linhas = [
    `${TIPO_PEDIDO[pedido.tipo]} #${pedido.numero}`,
    pedido.cliente ? pedido.cliente.nome : "",
    "",
    ...pedido.itens.map(
      (item) =>
        `${formatarQuantidade(item.quantidade)} × ${item.nome} — ${formatBRL(item.total)}`,
    ),
    "",
    `Total: ${formatBRL(pedido.total)}`,
    pedido.condicao ? `Pagamento: ${pedido.condicao.nome}` : "",
  ];
  return linhas
    .filter((linha, indice, todas) => linha || todas[indice - 1])
    .join("\n");
}

export function DetalheDoPedido({ saleId }: { saleId: string }) {
  const { data: pedido, isPending, error } = usePedidoFv(saleId);
  const cancelar = useCancelarPedidoFv();
  const enviarOrcamento = useEnviarOrcamentoFv();
  const decidir = useDecidirPedidoFv();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (isPending) {
    return (
      <FvPagina titulo="Pedido" voltarPara="/forca-de-vendas/pedidos">
        <Skeleton className="h-40" />
      </FvPagina>
    );
  }
  if (!pedido) {
    return (
      <FvPagina titulo="Pedido" voltarPara="/forca-de-vendas/pedidos">
        <Vazio>{error?.message ?? "Pedido não encontrado."}</Vazio>
      </FvPagina>
    );
  }

  const podeCancelar =
    (pedido.ehMeu &&
      (pedido.status === "DRAFT" || pedido.status === "PENDING_APPROVAL")) ||
    (pedido.podeAprovar && pedido.status === "CONFIRMED");
  const podeDecidir =
    pedido.podeAprovar && pedido.status === "PENDING_APPROVAL";
  const teveCorte = pedido.itens.some(
    (item) => item.quantidade !== item.quantidadePedida,
  );

  return (
    <FvPagina
      titulo={`${TIPO_PEDIDO[pedido.tipo]} #${pedido.numero}`}
      voltarPara="/forca-de-vendas/pedidos"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusPedidoBadge status={pedido.status} />
        <span className="text-sm text-muted-foreground">
          {formatarDataHora(pedido.criadoEm)}
          {pedido.vendedor && !pedido.ehMeu ? ` · ${pedido.vendedor}` : ""}
        </span>
      </div>

      {pedido.cliente ? (
        <Link
          href={`/forca-de-vendas/clientes/${pedido.cliente.id}`}
          className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3"
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {pedido.cliente.nome}
            </span>
            {pedido.cliente.cidade ? (
              <span className="block text-xs text-muted-foreground">
                {pedido.cliente.cidade}
              </span>
            ) : null}
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      ) : null}

      {pedido.status === "PENDING_APPROVAL" ? (
        <MotivosDeAprovacao motivos={pedido.motivos} />
      ) : null}
      {pedido.status === "CANCELLED" && pedido.motivoRecusa ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {pedido.motivoRecusa}
        </p>
      ) : null}

      <Secao titulo="Itens">
        <ul className="flex flex-col divide-y">
          {pedido.itens.map((item) => (
            <li key={item.id} className="flex flex-col gap-0.5 py-2 text-sm">
              <span className="font-medium">{item.nome}</span>
              <span className="flex justify-between gap-2 text-muted-foreground tabular-nums">
                <span>
                  {formatarQuantidade(item.quantidade)} ×{" "}
                  {formatBRL(item.precoUnitario)}
                  {item.quantidade !== item.quantidadePedida
                    ? ` (pedido ${formatarQuantidade(item.quantidadePedida)})`
                    : ""}
                </span>
                <span className="font-medium text-foreground">
                  {formatBRL(item.total)}
                </span>
              </span>
              {item.precoTabela !== null &&
              item.precoTabela !== item.precoUnitario ? (
                <span
                  className={cn(
                    "text-xs",
                    item.precoUnitario < item.precoTabela
                      ? "text-amber-700"
                      : "text-emerald-600",
                  )}
                >
                  Tabela {formatBRL(item.precoTabela)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {teveCorte ? (
          <p className="text-xs text-muted-foreground">
            Houve corte no faturamento.
          </p>
        ) : null}
      </Secao>

      <Secao titulo="Resumo">
        <Linha rotulo="Total" valor={formatBRL(pedido.total)} />
        {pedido.condicao ? (
          <Linha
            rotulo="Pagamento"
            valor={`${pedido.condicao.nome} (${descreverPrazos(pedido.condicao.prazosDias)})`}
          />
        ) : null}
        {pedido.tipo === "VENDA" ? (
          <Linha
            rotulo="Flex previsto"
            valor={formatBRL(pedido.flexPrevisto)}
            destaque={
              pedido.flexPrevisto < 0
                ? "erro"
                : pedido.flexPrevisto > 0
                  ? "ok"
                  : undefined
            }
          />
        ) : null}
        {pedido.status !== "DRAFT" && pedido.status !== "CANCELLED" ? (
          <Linha
            rotulo="Receptor"
            valor={
              pedido.statusDestino === "ACEITO"
                ? `Recebido ${pedido.referenciaDestino ?? ""}`
                : pedido.statusDestino === "ERRO"
                  ? "Falha no envio"
                  : "Aguardando"
            }
            destaque={pedido.statusDestino === "ERRO" ? "erro" : undefined}
          />
        ) : null}
        {pedido.observacao ? (
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {pedido.observacao}
          </p>
        ) : null}
      </Secao>

      <div className="flex flex-col gap-2">
        {pedido.cliente?.telefone ? (
          <Button variant="outline" asChild>
            <a
              href={linkWhatsapp(
                pedido.cliente.telefone,
                textoParaWhatsapp(pedido),
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="size-4" />
              Enviar resumo no WhatsApp
            </a>
          </Button>
        ) : null}
        {pedido.ehMeu &&
        pedido.status === "DRAFT" &&
        pedido.tipo === "ORCAMENTO" ? (
          <Button
            disabled={enviarOrcamento.isPending}
            onClick={() => enviarOrcamento.mutate({ saleId: pedido.saleId })}
          >
            Transformar em pedido
          </Button>
        ) : null}
        {podeDecidir ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              disabled={decidir.isPending}
              onClick={() =>
                decidir.mutate({ saleId: pedido.saleId, aprovar: true })
              }
            >
              Aprovar
            </Button>
            <Button variant="outline" onClick={() => setRecusando(true)}>
              Recusar
            </Button>
          </div>
        ) : null}
        {podeCancelar ? (
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={cancelar.isPending}
            onClick={() => cancelar.mutate({ saleId: pedido.saleId })}
          >
            Cancelar {pedido.status === "DRAFT" ? "orçamento" : "pedido"}
          </Button>
        ) : null}
      </div>

      <Dialog open={recusando} onOpenChange={setRecusando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar pedido #{pedido.numero}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="O vendedor vai ler este motivo"
          />
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!motivo.trim() || decidir.isPending}
              onClick={() =>
                decidir.mutate(
                  {
                    saleId: pedido.saleId,
                    aprovar: false,
                    motivoRecusa: motivo,
                  },
                  { onSuccess: () => setRecusando(false) },
                )
              }
            >
              Recusar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FvPagina>
  );
}
