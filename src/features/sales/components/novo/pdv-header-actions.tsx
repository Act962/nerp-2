"use client";

import { Button } from "@/components/ui/button";
import { usePdvShortcuts } from "@/features/pdv-shortcuts/hooks/use-pdv-shortcuts";
import { usePdvUiStore } from "@/features/sales/pdv-ui-store";
import { usePendingCatalogOrders } from "@/features/sales/hooks/use-pending-orders";

// Botões "Balança", "X novos pedidos" e "Atalhos" na barra do topo. Ficam no
// app-header (só na rota do PDV) e disparam os diálogos hospedados na tela
// de venda via store.
export function PdvHeaderActions() {
  const setWeighedOpen = usePdvUiStore((state) => state.setWeighedOpen);
  const setShortcutsOpen = usePdvUiStore((state) => state.setShortcutsOpen);
  const setPendingOrdersOpen = usePdvUiStore(
    (state) => state.setPendingOrdersOpen,
  );
  const { bindings } = usePdvShortcuts();
  // Poll da fila de pedidos do Catálogo Online (modo APPROVAL). O botão só
  // aparece quando há pelo menos 1 pra reduzir ruído em orgs que não usam
  // esse fluxo.
  const { data: pending } = usePendingCatalogOrders();
  const count = pending?.count ?? 0;

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setWeighedOpen(true)}
      >
        Balança
      </Button>
      {count > 0 && (
        <Button
          type="button"
          size="sm"
          onClick={() => setPendingOrdersOpen(true)}
        >
          {count} {count === 1 ? "novo pedido" : "novos pedidos"}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShortcutsOpen(true)}
      >
        Atalhos ({bindings["ajuda-atalhos"]})
      </Button>
    </div>
  );
}
