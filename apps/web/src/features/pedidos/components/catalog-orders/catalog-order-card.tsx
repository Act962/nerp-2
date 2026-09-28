"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { usePdvUiStore } from "@/features/sales/pdv-ui-store";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/utils/currency-formatter";
import { phoneMask } from "@/utils/format-phone";
import { ExternalLink, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  type CatalogOrder,
  useOpenCatalogOrderInPdv,
} from "../../hooks/use-catalog-orders";
import { formatTimeAgo } from "../../utils/time-ago";
import { ORIGIN_CONFIG, PAYMENT_LABELS, whatsappHref } from "./origin-config";
import { RejectCatalogOrderDialog } from "./reject-catalog-order-dialog";

interface CatalogOrderCardProps {
  order: CatalogOrder;
  now: number;
}

export function CatalogOrderCard({ order, now }: CatalogOrderCardProps) {
  const router = useRouter();
  const setHydratePayload = usePdvUiStore((state) => state.setHydratePayload);
  const openInPdv = useOpenCatalogOrderInPdv();
  const [rejectOpen, setRejectOpen] = useState(false);

  const origin = ORIGIN_CONFIG[order.origin];
  const isPending = order.status === "PENDING_APPROVAL";
  const isOrbita = order.origin === "CATALOGO_ORBITA";
  const canActInStore = isPending && order.origin === "CATALOGO_APROVACAO";
  const customerWhatsapp = whatsappHref(order.customerPhone);

  // Mesmo caminho do "Aprovar" do diálogo do PDV: a venda pendente fecha, o
  // carrinho vai pelo store e o /vendas/novo o consome ao montar.
  function handleOpenInPdv() {
    openInPdv.mutate(
      { saleId: order.id },
      {
        onSuccess: (result) => {
          setHydratePayload({
            customer: result.customer,
            items: result.items.map((item) => ({
              productId: item.productId,
              name: item.name,
              sku: item.sku,
              barcode: item.barcode,
              image: item.image,
              salePrice: item.salePrice,
              costPrice: item.costPrice,
              currentStock: item.currentStock,
              minStock: item.minStock,
              unit: item.unit,
              isActive: item.isActive,
              trackStock: item.trackStock,
              quantity: item.quantity,
            })),
          });
          toast.success("Pedido carregado no PDV");
          router.push("/vendas/novo");
        },
      },
    );
  }

  return (
    <Card className="gap-3 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn(origin.badgeClassName)}>{origin.label}</Badge>
        {isOrbita && isPending && (
          <Badge variant="outline">Negociando no Órbita</Badge>
        )}
        {order.closure?.kind === "APPROVED_AT_PDV" && (
          <Badge variant="secondary">Virou venda no PDV</Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {formatTimeAgo(order.createdAt, now)}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">Pedido #{order.saleNumber}</p>
        <p className="font-semibold tabular-nums">{formatBRL(order.total)}</p>
      </div>

      <div className="flex flex-col gap-0.5 text-sm">
        <p className="truncate">
          {order.customerName ?? "Cliente sem cadastro"}
        </p>
        {order.customerPhone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{phoneMask(order.customerPhone)}</span>
            {customerWhatsapp && (
              <a
                href={customerWhatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <MessageCircle className="size-3" />
                WhatsApp
              </a>
            )}
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-1 rounded-md bg-muted/50 p-2 text-xs">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-2">
            <span className="min-w-0 truncate">
              {item.quantity}x {item.name}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatBRL(item.total)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {order.paymentMethod && (
          <p>Pagamento: {PAYMENT_LABELS[order.paymentMethod]}</p>
        )}
        {order.shipping > 0 && <p>Frete: {formatBRL(order.shipping)}</p>}
        {order.closure?.kind === "REJECTED" && (
          <p className="text-destructive">Recusado: {order.closure.reason}</p>
        )}
      </div>

      {isOrbita && order.orbitaPortalUrl && (
        <Button asChild variant="outline" size="sm">
          <a href={order.orbitaPortalUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            Ver pedido no Órbita
          </a>
        </Button>
      )}

      {canActInStore && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="flex-1"
            onClick={handleOpenInPdv}
            disabled={openInPdv.isPending}
          >
            {openInPdv.isPending ? <Spinner /> : "Abrir no PDV"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setRejectOpen(true)}
            disabled={openInPdv.isPending}
          >
            Recusar
          </Button>
          <RejectCatalogOrderDialog
            saleId={order.id}
            saleNumber={order.saleNumber}
            open={rejectOpen}
            onOpenChange={setRejectOpen}
          />
        </div>
      )}
    </Card>
  );
}
