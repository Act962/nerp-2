"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CatalogStatusGroup } from "@/features/pedidos/utils/catalog-order-status";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCatalogOrders } from "../../hooks/use-catalog-orders";
import { CatalogOrderCard } from "./catalog-order-card";

interface CatalogOrderColumnProps {
  status: CatalogStatusGroup;
  title: string;
  emptyMessage: string;
  now: number;
}

export function CatalogOrderColumn({
  status,
  title,
  emptyMessage,
  now,
}: CatalogOrderColumnProps) {
  const pagination = useCursorPagination();
  const { data, isLoading, isError } = useCatalogOrders({
    status,
    cursor: pagination.cursor,
  });
  const orders = data?.orders ?? [];
  const nextCursor = data?.nextCursor ?? null;

  return (
    <section className="flex min-h-0 flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <header className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {!isLoading && (
          <Badge variant="secondary">
            {orders.length}
            {nextCursor ? "+" : ""}
          </Badge>
        )}
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <p className="py-6 text-center text-sm text-destructive">
          Não foi possível carregar os pedidos.
        </p>
      ) : orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <CatalogOrderCard key={order.id} order={order} now={now} />
          ))}
        </div>
      )}

      {(pagination.hasPrevious || nextCursor) && (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={pagination.goPrevious}
            disabled={!pagination.hasPrevious}
          >
            <ChevronLeft className="size-4" />
            Anteriores
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {pagination.pageIndex}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => pagination.goNext(nextCursor)}
            disabled={!nextCursor}
          >
            Mais antigos
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </section>
  );
}
