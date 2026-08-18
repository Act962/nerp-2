"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { constructUrl } from "@/hooks/use-construct-url";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNow, formatElapsed } from "@/hooks/use-elapsed";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PREP_MINUTES,
  getOrderUrgency,
  urgencyStyles,
} from "@/utils/pedidos-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArrowRight,
  CheckCheck,
  Clock,
  GripVertical,
  MoreVertical,
} from "lucide-react";
import type { KitchenColumn } from "../hooks/use-pedidos-columns";
import {
  useMutationMoveKitchenOrder,
  useMutationSetArchivedKitchenOrder,
} from "../hooks/use-pedidos";
import type { KitchenOrder } from "../hooks/use-pedidos";

interface OrderCardProps {
  order: KitchenOrder;
  // próxima coluna por position (p/ o botão de avançar); null em colunas isFinal
  nextColumn: KitchenColumn | null;
  // coluna terminal (isFinal); alvo da ação direta "Entregue". null se a org não tiver
  finalColumn?: KitchenColumn | null;
  // coluna inicial (isInitial) não mostra atalho "Entregue".
  isInitialColumn?: boolean;
  // quando true, é só o "fantasma" do DragOverlay (sem listeners/sortable)
  overlay?: boolean;
}

export function OrderCard({
  order,
  nextColumn,
  finalColumn = null,
  isInitialColumn = false,
  overlay = false,
}: OrderCardProps) {
  const move = useMutationMoveKitchenOrder();
  const setArchived = useMutationSetArchivedKitchenOrder();

  // Pedido entregue (na coluna final): congela o contador no momento em que
  // entrou na coluna e para de pulsar — não conta mais tempo nem alerta atraso.
  const isDelivered = finalColumn != null && order.columnId === finalColumn.id;

  // Relógio de 1s: o decorrido (mm:ss) e a urgência são recalculados no cliente
  // a partir de createdAt/estimatedMinutes, sem depender do polling.
  const now = useNow();
  const refTime = isDelivered ? new Date(order.columnEnteredAt).getTime() : now;
  const urgency = getOrderUrgency(
    order.createdAt,
    order.estimatedMinutes,
    refTime,
  );
  const style = urgencyStyles[urgency];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: order.id,
    data: { columnId: order.columnId },
    disabled: overlay,
  });

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : dndStyle}
      className={cn(
        "gap-2 border-2 p-3 shadow-sm",
        style.border,
        isDragging && "opacity-40",
        overlay && "rotate-3 shadow-lg",
        // entregue: para de pulsar (sobrescreve o animate-pulse do "overdue")
        isDelivered && "animate-none",
      )}
    >
      <div className="flex items-start gap-2">
        {/* Handle de arraste: só ele inicia o drag, p/ não conflitar com cliques. */}
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          aria-label="Arrastar pedido"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-base font-bold leading-tight tracking-tight">
            Mesa {order.tableNumber}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="mt-0.5 block w-full truncate text-xs font-medium text-muted-foreground">
                {order.dishName}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              Mesa {order.tableNumber} · {order.dishName}
            </TooltipContent>
          </Tooltip>

          {order.attendantName && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Avatar className="size-5">
                {order.attendantPhoto && (
                  <AvatarImage
                    src={constructUrl(order.attendantPhoto)}
                    alt={order.attendantName}
                  />
                )}
                <AvatarFallback className="text-[10px]">
                  {order.attendantName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{order.attendantName}</span>
            </div>
          )}

          {order.notes && (
            <p className="mt-1.5 whitespace-pre-wrap break-words rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
              {order.notes}
            </p>
          )}
        </div>

        {/* Menu de ações no canto superior direito (não inicia o arraste). */}
        {!overlay && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="-mr-1 -mt-1 shrink-0 text-muted-foreground"
                aria-label="Ações do pedido"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={setArchived.isPending}
                onClick={() =>
                  setArchived.mutate({ id: order.id, archived: true })
                }
              >
                <Archive className="size-4" />
                Arquivar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Fallback por botão: avança p/ a próxima coluna sem arrastar.
          Oculto quando a próxima já é a final — aí usamos o botão "Entregue". */}
      {nextColumn && nextColumn.id !== finalColumn?.id && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full justify-center"
          disabled={move.isPending}
          onClick={() =>
            move.mutate({ id: order.id, toColumnId: nextColumn.id })
          }
        >
          <ArrowRight className="size-3.5" />
          {nextColumn.name}
        </Button>
      )}

      <div className="flex min-w-0 items-center gap-1 text-[10px]">
        <Badge
          className={cn(
            "shrink-0 gap-0.5 px-1.5 py-0 text-[10px] leading-4",
            style.badge,
          )}
        >
          <Clock className="size-2.5" />
          {formatElapsed(order.createdAt, refTime)}
        </Badge>
        <Badge
          variant="outline"
          className="shrink-0 px-1.5 py-0 text-[10px] leading-4"
        >
          ~{order.estimatedMinutes ?? DEFAULT_PREP_MINUTES}m
        </Badge>
        {urgency !== "normal" && (
          <Badge
            className={cn(
              "min-w-0 truncate px-1.5 py-0 text-[10px] leading-4",
              style.badge,
            )}
          >
            {style.label}
          </Badge>
        )}
      </div>

      {/* Ação direta: marca como entregue movendo o card p/ a coluna final.
          Sempre no rodapé do card; não aparece na coluna inicial. */}
      {finalColumn &&
        order.columnId !== finalColumn.id &&
        !isInitialColumn && (
          <Button
            type="button"
            size="sm"
            className="mt-auto w-full justify-center"
            disabled={move.isPending}
            onClick={() =>
              move.mutate({ id: order.id, toColumnId: finalColumn.id })
            }
          >
            <CheckCheck className="size-3.5" />
            Entregue
          </Button>
        )}
    </Card>
  );
}
