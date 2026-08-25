"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { currencyFormatter } from "@/utils/currency-formatter";
import { usePdvUiStore } from "@/features/sales/pdv-ui-store";
import {
  useApprovePending,
  usePendingCatalogOrders,
} from "@/features/sales/hooks/use-pending-orders";
import { toast } from "sonner";
import dayjs from "dayjs";

// Modal listando pedidos do Catálogo Online aguardando aprovação.
// Ao clicar "Aprovar": chama backend, recebe items + cliente, injeta no
// store da UI — o carrinho do /vendas/novo consome via useEffect.
export function PendingOrdersDialog() {
  const open = usePdvUiStore((state) => state.pendingOrdersOpen);
  const setOpen = usePdvUiStore((state) => state.setPendingOrdersOpen);
  const setHydratePayload = usePdvUiStore(
    (state) => state.setHydratePayload,
  );

  const { data, isLoading } = usePendingCatalogOrders();
  const approve = useApprovePending();

  async function handleApprove(saleId: string) {
    try {
      const result = await approve.mutateAsync({ saleId });
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
      setOpen(false);
      toast.success("Pedido aprovado — carrinho carregado");
    } catch {
      // toast do onError já cobre
    }
  }

  const orders = data?.orders ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pedidos aguardando aprovação</DialogTitle>
          <DialogDescription>
            Pedidos feitos pelo Catálogo Online — aprove para carregar o
            carrinho e finalizar a venda no balcão.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum pedido aguardando aprovação.
          </p>
        ) : (
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {order.customerName ?? "Cliente sem cadastro"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pedido #{order.saleNumber} ·{" "}
                    {dayjs(order.createdAt).format("DD/MM/YYYY HH:mm")} ·{" "}
                    {order.itemsCount}{" "}
                    {order.itemsCount === 1 ? "item" : "itens"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">
                    R$ {currencyFormatter(order.total)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleApprove(order.id)}
                    disabled={approve.isPending}
                  >
                    {approve.isPending ? <Spinner /> : "Aprovar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
