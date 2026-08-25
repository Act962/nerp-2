"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatElapsed } from "@/hooks/use-elapsed";
import { Archive, Clock, RotateCcw } from "lucide-react";
import {
  useMutationSetArchivedKitchenOrder,
  useQueryArchivedKitchenOrders,
} from "../hooks/use-pedidos";

export function ArchivedOrders() {
  const { data: orders = [] } = useQueryArchivedKitchenOrders();
  const setArchived = useMutationSetArchivedKitchenOrder();

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Archive className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Arquivados</span>
        <Badge variant="secondary">{orders.length}</Badge>
      </div>

      {orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum pedido arquivado.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orders.map((order) => (
            <Card key={order.id} className="gap-2 p-3 opacity-80 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                  Mesa {order.tableNumber} · {order.dishName}
                </p>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="-mr-1 -mt-1 shrink-0 text-muted-foreground"
                  aria-label="Restaurar pedido"
                  disabled={setArchived.isPending}
                  onClick={() =>
                    setArchived.mutate({ id: order.id, archived: false })
                  }
                >
                  <RotateCcw className="size-4" />
                </Button>
              </div>

              {/* Tempo de preparo congelado (criação → última coluna). */}
              <Badge variant="outline" className="w-fit gap-1">
                <Clock className="size-3" />
                {formatElapsed(
                  order.createdAt,
                  new Date(order.columnEnteredAt).getTime(),
                )}
              </Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
