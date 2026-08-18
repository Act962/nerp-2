import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { useState } from "react";
import { toast } from "sonner";
import type { KitchenColumn } from "./use-pedidos-columns";
import { useMutationMoveKitchenOrder } from "./use-pedidos";

interface UseKanbanDndProps {
  columns: KitchenColumn[];
  // contagem atual de cards por columnId (p/ bloqueio de WIP no cliente)
  countIn: (columnId: string) => number;
}

// Encapsula o estado e a transição do DndContext (genérica, baseada em columnId).
export function useKanbanDnd({ columns, countIn }: UseKanbanDndProps) {
  const [activeId, setActiveId] = useState<string | null>(null); // p/ o DragOverlay
  // coluna de origem do card em arraste — as colunas usam isso p/ não se
  // destacarem como alvo da própria origem e p/ exibir o "Solte aqui".
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const move = useMutationMoveKitchenOrder();

  function reset() {
    setActiveId(null);
    setActiveColumnId(null);
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
    setActiveColumnId(
      (event.active.data.current?.columnId as string | undefined) ?? null,
    );
  }

  // Arraste cancelado (ESC / drop fora) — limpa o estado p/ encerrar o realce.
  function onDragCancel() {
    reset();
  }

  function onDragEnd(event: DragEndEvent) {
    const from = event.active.data.current?.columnId as string | undefined;
    const to = (event.over?.data.current?.columnId ?? event.over?.id) as
      | string
      | undefined;
    reset();

    if (!from || !to || from === to) return; // mesma coluna ⇒ snap back

    // Bloqueio de WIP no cliente p/ feedback imediato (o servidor é a fonte de verdade).
    const dest = columns.find((c) => c.id === to);
    if (dest?.wipLimit != null && countIn(to) >= dest.wipLimit) {
      toast.error(
        `Coluna "${dest.name}" está cheia (limite ${dest.wipLimit}).`,
      );
      return;
    }

    move.mutate({ id: event.active.id as string, toColumnId: to });
  }

  return {
    activeId,
    activeColumnId,
    setActiveId,
    onDragStart,
    onDragCancel,
    onDragEnd,
  };
}
