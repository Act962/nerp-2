"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNow, formatElapsed } from "@/hooks/use-elapsed";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PREP_MINUTES,
  getOrderUrgency,
  urgencyStyles,
} from "@/utils/pedidos-config";
import { CheckCheck, Clock, QrCode } from "lucide-react";
import type { WaiterOrder } from "../utils/categorize";

interface Props {
  order: WaiterOrder;
  onOpenQr?: (order: WaiterOrder) => void;
  onDeliver?: (order: WaiterOrder) => void;
  deliverPending?: boolean;
}

export function WaiterOrderCard({
  order,
  onOpenQr,
  onDeliver,
  deliverPending = false,
}: Props) {
  const isDone = order.columnIsFinal || order.archivedAt != null;
  const now = useNow();
  const refTime = isDone
    ? new Date(order.columnEnteredAt).getTime()
    : now;
  const urgency = getOrderUrgency(
    order.createdAt,
    order.estimatedMinutes,
    refTime,
  );
  const style = urgencyStyles[urgency];

  return (
    <Card
      role={onOpenQr ? "button" : undefined}
      tabIndex={onOpenQr ? 0 : undefined}
      onClick={onOpenQr ? () => onOpenQr(order) : undefined}
      onKeyDown={
        onOpenQr
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenQr(order);
              }
            }
          : undefined
      }
      className={cn(
        "gap-2 border-2 p-3 shadow-sm",
        style.border,
        order.columnShowOnTv && !order.archivedAt && "border-emerald-500",
        isDone && "animate-none opacity-80",
        onOpenQr &&
          "cursor-pointer transition active:scale-[0.99] hover:bg-accent",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            Mesa {order.tableNumber} · {order.dishName}
          </p>
          {order.notes && (
            <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {order.notes}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge
            variant="outline"
            style={{ borderColor: order.columnColor, color: order.columnColor }}
          >
            {order.columnName}
          </Badge>
          {onOpenQr && (
            <QrCode className="size-4 text-muted-foreground" aria-hidden />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className={cn("gap-1", style.badge)}>
          <Clock className="size-3" />
          {formatElapsed(order.createdAt, refTime)}
        </Badge>
        <Badge variant="outline">
          ~{order.estimatedMinutes ?? DEFAULT_PREP_MINUTES} min
        </Badge>
        {urgency !== "normal" && !isDone && (
          <Badge className={style.badge}>{style.label}</Badge>
        )}
      </div>

      {/* Botão Entregue: aparece em pedidos prontos (showOnTv) p/ o garçom
          marcar quando levar à mesa. */}
      {onDeliver && order.columnShowOnTv && !order.archivedAt && (
        <Button
          type="button"
          size="sm"
          className="mt-1 w-full justify-center bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={deliverPending}
          onClick={(event) => {
            event.stopPropagation();
            onDeliver(order);
          }}
        >
          <CheckCheck className="size-4" />
          Entregue ao cliente
        </Button>
      )}
    </Card>
  );
}
