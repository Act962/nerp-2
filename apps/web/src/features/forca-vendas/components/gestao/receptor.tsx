"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { StatusFiltroPedido } from "../../hooks/use-forca-vendas";
import {
  useCancelarPedidoGestao,
  useDecidirPedidoGestao,
  useFaturarPedidoGestao,
  usePedidoGestao,
  usePedidosGestao,
  useVendedoresGestao,
} from "../../hooks/use-gestao-fv";
import {
  formatarDataHora,
  formatarQuantidade,
  formatBRL,
  TIPO_PEDIDO,
} from "../../lib/formatar";
import { descreverPrazos } from "../../lib/parcelas";
import { lerDecimal } from "../../lib/posicao";
import { MOTIVO_LABEL, type MotivoAprovacao } from "../../lib/regras-pedido";
import { StatusPedidoBadge } from "../fv-pagina";

const FILTROS: Array<{ valor: StatusFiltroPedido | "TODOS"; rotulo: string }> =
  [
    { valor: "PENDING_APPROVAL", rotulo: "Em aprovação" },
    { valor: "CONFIRMED", rotulo: "Aprovados (a faturar)" },
    { valor: "COMPLETED", rotulo: "Faturados" },
    { valor: "CANCELLED", rotulo: "Cancelados" },
    { valor: "DRAFT", rotulo: "Orçamentos" },
    { valor: "TODOS", rotulo: "Todos" },
  ];

function DetalheNoReceptor({
  saleId,
  onFechar,
}: {
  saleId: string | null;
  onFechar: () => void;
}) {
  const { data: pedido, isPending } = usePedidoGestao(saleId);
  const decidir = useDecidirPedidoGestao();
  const faturar = useFaturarPedidoGestao();
  const cancelar = useCancelarPedidoGestao();
  const [motivo, setMotivo] = useState("");
  const [cortes, setCortes] = useState<Record<string, string>>({});

  const quantidadeFaturada = (itemId: string, pedida: number) => {
    const texto = cortes[itemId];
    if (texto === undefined) return pedida;
    return lerDecimal(texto) ?? pedida;
  };

  return (
    <Dialog open={Boolean(saleId)} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        {isPending || !pedido ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {TIPO_PEDIDO[pedido.tipo]} #{pedido.numero}
                <StatusPedidoBadge status={pedido.status} />
              </DialogTitle>
              <DialogDescription>
                {pedido.cliente?.nome ?? "Sem cliente"} ·{" "}
                {pedido.vendedor ?? "—"} · {formatarDataHora(pedido.criadoEm)}
              </DialogDescription>
            </DialogHeader>

            {pedido.motivos.length > 0 &&
            pedido.status === "PENDING_APPROVAL" ? (
              <div className="flex flex-wrap gap-1.5">
                {pedido.motivos.map((m) => (
                  <Badge
                    key={m}
                    variant="secondary"
                    className="bg-amber-100 text-amber-800"
                  >
                    {MOTIVO_LABEL[m as MotivoAprovacao] ?? m}
                  </Badge>
                ))}
              </div>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Tabela</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  {pedido.status === "CONFIRMED" ? (
                    <TableHead className="text-right">Faturar</TableHead>
                  ) : null}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedido.itens.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-[220px] whitespace-normal">
                      {item.nome}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.precoTabela === null
                        ? "—"
                        : formatBRL(item.precoTabela)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(item.precoUnitario)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatarQuantidade(item.quantidade)}
                      {item.quantidade !== item.quantidadePedida
                        ? ` / ${formatarQuantidade(item.quantidadePedida)}`
                        : ""}
                    </TableCell>
                    {pedido.status === "CONFIRMED" ? (
                      <TableCell className="text-right">
                        <Input
                          className="ml-auto h-8 w-20 text-right tabular-nums"
                          inputMode="decimal"
                          value={cortes[item.id] ?? String(item.quantidade)}
                          onChange={(event) =>
                            setCortes((atual) => ({
                              ...atual,
                              [item.id]: event.target.value,
                            }))
                          }
                          aria-label={`Quantidade a faturar de ${item.nome}`}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(
                        item.precoUnitario *
                          (pedido.status === "CONFIRMED"
                            ? quantidadeFaturada(item.id, item.quantidade)
                            : item.quantidade),
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="grid gap-1 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Total: </span>
                <strong className="tabular-nums">
                  {formatBRL(pedido.total)}
                </strong>
              </p>
              {pedido.condicao ? (
                <p>
                  <span className="text-muted-foreground">Pagamento: </span>
                  {pedido.condicao.nome} (
                  {descreverPrazos(pedido.condicao.prazosDias)})
                </p>
              ) : null}
              {pedido.tipo === "VENDA" ? (
                <p>
                  <span className="text-muted-foreground">Flex previsto: </span>
                  <span className="tabular-nums">
                    {formatBRL(pedido.flexPrevisto)}
                  </span>
                </p>
              ) : null}
              <p>
                <span className="text-muted-foreground">Destino: </span>
                {pedido.destino === "NATIVO" ? "NERP" : pedido.destino} ·{" "}
                {pedido.statusDestino === "ACEITO"
                  ? `recebido ${pedido.referenciaDestino ?? ""}`
                  : pedido.statusDestino === "ERRO"
                    ? (pedido.erroDestino ?? "falha")
                    : "aguardando"}
              </p>
            </div>
            {pedido.observacao ? (
              <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">
                {pedido.observacao}
              </p>
            ) : null}

            {pedido.status === "PENDING_APPROVAL" ? (
              <Textarea
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Motivo da recusa (o vendedor vê este texto)"
                rows={2}
              />
            ) : null}

            <DialogFooter className="gap-2">
              {pedido.status === "PENDING_APPROVAL" ? (
                <>
                  <Button
                    variant="outline"
                    disabled={!motivo.trim() || decidir.isPending}
                    onClick={() =>
                      decidir.mutate(
                        {
                          saleId: pedido.saleId,
                          aprovar: false,
                          motivoRecusa: motivo,
                        },
                        { onSuccess: onFechar },
                      )
                    }
                  >
                    Recusar
                  </Button>
                  <Button
                    disabled={decidir.isPending}
                    onClick={() =>
                      decidir.mutate(
                        { saleId: pedido.saleId, aprovar: true },
                        { onSuccess: onFechar },
                      )
                    }
                  >
                    Aprovar
                  </Button>
                </>
              ) : null}
              {pedido.status === "CONFIRMED" ? (
                <>
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    disabled={cancelar.isPending}
                    onClick={() =>
                      cancelar.mutate(
                        { saleId: pedido.saleId },
                        { onSuccess: onFechar },
                      )
                    }
                  >
                    Cancelar pedido
                  </Button>
                  <Button
                    disabled={faturar.isPending}
                    onClick={() =>
                      faturar.mutate(
                        {
                          saleId: pedido.saleId,
                          cortes: pedido.itens
                            .filter((item) => cortes[item.id] !== undefined)
                            .map((item) => ({
                              itemId: item.id,
                              quantidade: quantidadeFaturada(
                                item.id,
                                item.quantidade,
                              ),
                            })),
                        },
                        { onSuccess: onFechar },
                      )
                    }
                  >
                    {faturar.isPending ? <Spinner /> : "Faturar"}
                  </Button>
                </>
              ) : null}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ReceptorDePedidos() {
  const [status, setStatus] = useState<StatusFiltroPedido | "TODOS">(
    "PENDING_APPROVAL",
  );
  const [memberId, setMemberId] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const { data: vendedores = [] } = useVendedoresGestao();
  const consulta = usePedidosGestao({
    status: status === "TODOS" ? null : status,
    memberId,
  });
  const pedidos =
    consulta.data?.pages.flatMap((pagina) => pagina.pedidos) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((filtro) => (
          <Button
            key={filtro.valor}
            size="sm"
            variant={status === filtro.valor ? "default" : "outline"}
            onClick={() => setStatus(filtro.valor)}
          >
            {filtro.rotulo}
          </Button>
        ))}
        <Select
          value={memberId ?? "todos"}
          onValueChange={(valor) =>
            setMemberId(valor === "todos" ? null : valor)
          }
        >
          <SelectTrigger className="ml-auto w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os vendedores</SelectItem>
            {vendedores.map((vendedor) => (
              <SelectItem key={vendedor.memberId} value={vendedor.memberId}>
                {vendedor.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consulta.isPending ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-10" />
                </TableCell>
              </TableRow>
            ) : pedidos.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  Nenhum pedido nesta situação.
                </TableCell>
              </TableRow>
            ) : (
              pedidos.map((pedido) => (
                <TableRow
                  key={pedido.saleId}
                  className="cursor-pointer"
                  onClick={() => setAberto(pedido.saleId)}
                >
                  <TableCell className="font-medium tabular-nums">
                    #{pedido.numero}
                    {pedido.tipo !== "VENDA" ? (
                      <Badge variant="outline" className="ml-2">
                        {TIPO_PEDIDO[pedido.tipo]}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{pedido.cliente?.nome ?? "—"}</TableCell>
                  <TableCell>{pedido.vendedor ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPedidoBadge status={pedido.status} />
                      {pedido.status === "PENDING_APPROVAL"
                        ? pedido.motivos.map((m) => (
                            <span key={m} className="text-xs text-amber-700">
                              {MOTIVO_LABEL[m as MotivoAprovacao] ?? m}
                            </span>
                          ))
                        : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(pedido.total)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatarDataHora(pedido.criadoEm)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {consulta.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => consulta.fetchNextPage()}
          disabled={consulta.isFetchingNextPage}
        >
          {consulta.isFetchingNextPage ? <Spinner /> : "Carregar mais"}
        </Button>
      ) : null}

      {/* Só monta com um pedido escolhido: sem isso a consulta do detalhe
          existia com id vazio e voltava 400 ao fechar o diálogo. */}
      {aberto ? (
        <DetalheNoReceptor
          key={aberto}
          saleId={aberto}
          onFechar={() => setAberto(null)}
        />
      ) : null}
    </div>
  );
}
