"use client";

import { Button } from "@/components/ui/button";
import { usePdvShortcuts } from "@/features/pdv-shortcuts/hooks/use-pdv-shortcuts";
import { usePdvUiStore } from "@/features/sales/pdv-ui-store";

// Botões "Balança" e "Atalhos" na barra do topo. Ficam no app-header (só na
// rota do PDV) e disparam os diálogos hospedados na tela de venda via store.
export function PdvHeaderActions() {
  const setWeighedOpen = usePdvUiStore((state) => state.setWeighedOpen);
  const setShortcutsOpen = usePdvUiStore((state) => state.setShortcutsOpen);
  const { bindings } = usePdvShortcuts();

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
