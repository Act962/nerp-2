"use client";

import { Badge } from "@/components/ui/badge";
import { CATALOG_ORIGINS } from "@/features/pedidos/utils/catalog-order-status";
import { useNow } from "@/hooks/use-elapsed";
import { cn } from "@/lib/utils";
import { CatalogOrderColumn } from "./catalog-order-column";
import { ORIGIN_CONFIG } from "./origin-config";

const COLUMNS = [
  {
    status: "PENDING",
    title: "Aguardando confirmação",
    emptyMessage: "Nenhum pedido aguardando.",
  },
  {
    status: "CONFIRMED",
    title: "Confirmados",
    emptyMessage: "Nenhum pedido confirmado.",
  },
  {
    status: "CANCELLED",
    title: "Cancelados",
    emptyMessage: "Nenhum pedido cancelado.",
  },
] as const;

export function CatalogOrdersBoard() {
  // "há 5 min" não precisa de segundo a segundo.
  const now = useNow(30_000);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
        <p className="text-muted-foreground">
          Todo pedido feito no Catálogo Online aparece aqui, seja qual for o
          modo de operação. A cor diz quem cuida dele:
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CATALOG_ORIGINS.map((origin) => (
            <li key={origin} className="flex items-start gap-2">
              <Badge className={cn(ORIGIN_CONFIG[origin].badgeClassName)}>
                {ORIGIN_CONFIG[origin].label}
              </Badge>
              <span className="text-muted-foreground">
                {ORIGIN_CONFIG[origin].description}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Pedido de Aprovação aberto no PDV fica em Cancelados como "Virou venda
          no PDV" — a venda de verdade é a feita no balcão.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {COLUMNS.map((column) => (
          <CatalogOrderColumn
            key={column.status}
            status={column.status}
            title={column.title}
            emptyMessage={column.emptyMessage}
            now={now}
          />
        ))}
      </div>
    </div>
  );
}
