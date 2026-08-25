"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  GripVertical,
} from "lucide-react";
import { useMemo, useState } from "react";

export interface ReorderItem {
  id: string;
  name: string;
}

interface ReorderPagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ReorderItem[];
  isSaving: boolean;
  onSave: (orderedIds: string[]) => void;
}

// Reordenação de páginas por busca + arrastar + posição digitada — as setas
// ↑/↓ por card não escalam num book de dezenas/centenas de páginas. Monte só
// quando aberto (o estado inicial vem de `items`); só aplica ao salvar.
export function ReorderPagesDialog({
  open,
  onOpenChange,
  items,
  isSaving,
  onSave,
}: ReorderPagesDialogProps) {
  const [order, setOrder] = useState<ReorderItem[]>(items);
  const [search, setSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const posById = useMemo(() => {
    const map = new Map<string, number>();
    order.forEach((it, i) => {
      map.set(it.id, i);
    });
    return map;
  }, [order]);

  const moveTo = (id: string, targetPos1: number) => {
    setOrder((prev) => {
      const from = prev.findIndex((p) => p.id === id);
      if (from === -1 || Number.isNaN(targetPos1)) return prev;
      const to = Math.max(0, Math.min(prev.length - 1, targetPos1 - 1));
      if (to === from) return prev;
      const next = [...prev];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  };

  const move = (id: string, delta: number) => {
    const from = posById.get(id);
    if (from == null) return;
    moveTo(id, from + 1 + delta);
  };

  // Arrastar: coloca a página solta na posição (global) da página sobre a qual
  // foi solta — funciona mesmo com a lista filtrada pela busca.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const overPos = posById.get(String(over.id));
    if (overPos == null) return;
    moveTo(String(active.id), overPos + 1);
  };

  const query = search.trim().toLowerCase();
  const visible = query
    ? order.filter((it) => it.name.toLowerCase().includes(query))
    : order;

  const changed = order.some((it, i) => items[i]?.id !== it.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reordenar páginas</DialogTitle>
          <DialogDescription>
            Arraste pela alça, ou digite a nova posição (ou use as setas).
            Busque pelo nome para achar a página. A ordem só é aplicada ao
            salvar.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar página pelo nome…"
        />

        <div className="flex-1 space-y-1 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma página encontrada.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visible.map((it) => it.id)}
                strategy={verticalListSortingStrategy}
              >
                {visible.map((it) => (
                  <SortableRow
                    key={it.id}
                    item={it}
                    pos={(posById.get(it.id) ?? 0) + 1}
                    total={order.length}
                    onMoveTo={moveTo}
                    onMove={move}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onSave(order.map((it) => it.id))}
            disabled={isSaving || !changed}
            className="gap-1"
          >
            {isSaving ? <Spinner className="size-4" /> : null}
            Salvar ordem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableRow({
  item,
  pos,
  total,
  onMoveTo,
  onMove,
}: {
  item: ReorderItem;
  pos: number;
  total: number;
  onMoveTo: (id: string, targetPos1: number) => void;
  onMove: (id: string, delta: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1 rounded-md border bg-card px-2 py-1.5 ${
        isDragging ? "opacity-60 shadow-md" : ""
      }`}
    >
      <button
        type="button"
        className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent active:cursor-grabbing"
        title="Arraste para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Input
        type="number"
        min={1}
        max={total}
        key={`${item.id}-${pos}`}
        defaultValue={pos}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onMoveTo(item.id, Number(e.currentTarget.value));
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => onMoveTo(item.id, Number(e.target.value))}
        className="h-8 w-14 shrink-0 text-center"
      />
      <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
      <div className="flex shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title="Para o topo"
          onClick={() => onMoveTo(item.id, 1)}
          disabled={pos === 1}
        >
          <ChevronsUp className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title="Subir"
          onClick={() => onMove(item.id, -1)}
          disabled={pos === 1}
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title="Descer"
          onClick={() => onMove(item.id, 1)}
          disabled={pos === total}
        >
          <ChevronDown className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title="Para o fim"
          onClick={() => onMoveTo(item.id, total)}
          disabled={pos === total}
        >
          <ChevronsDown className="size-4" />
        </Button>
      </div>
    </div>
  );
}
