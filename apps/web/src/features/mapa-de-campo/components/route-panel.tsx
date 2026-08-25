"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Crosshair, GripVertical, Route, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useMyRoute,
  useOptimizeRoute,
  useRemoveRouteStop,
  useReorderRoute,
} from "@/features/promoter-route/hooks/use-promoter-route";

export interface RouteStop {
  id: string;
  position: number;
  kind: "STORE" | "DIRECTORY";
  targetId: string;
  name: string;
  latitude: number;
  longitude: number;
}

function SortableStop({
  stop,
  index,
  onRemove,
  onFocus,
}: {
  stop: RouteStop;
  index: number;
  onRemove: () => void;
  onFocus: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="flex items-center gap-2 rounded-md border bg-background p-2"
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground"
        aria-label="Arrastar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums">
        {index + 1}
      </span>
      <button
        type="button"
        onClick={onFocus}
        className="min-w-0 flex-1 text-left text-sm hover:underline"
      >
        <span className="block truncate font-medium">{stop.name}</span>
        <span className="text-xs text-muted-foreground">
          {stop.kind === "STORE" ? "Cliente" : "Ponto do OpenStreetMap"}
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-destructive"
        aria-label={`Remover ${stop.name} da rota`}
        onClick={onRemove}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}

/**
 * A rota do promotor: a ordem em que ele planeja visitar.
 *
 * A distância é em linha reta entre paradas — não é quilometragem de rua, e a
 * tela diz isso. Um número apresentado como se fosse odômetro viraria base de
 * cobrança para algo que não foi medido assim.
 */
export function RoutePanel({
  open,
  onOpenChange,
  onFocusStop,
  onFrameRoute,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFocusStop?: (point: { latitude: number; longitude: number }) => void;
  onFrameRoute?: () => void;
}) {
  const { stops, totalMeters, isLoading } = useMyRoute();
  const removeStop = useRemoveRouteStop();
  const reorder = useReorderRoute();
  const optimize = useOptimizeRoute();

  const sensors = useSensors(
    // Sem esta distância mínima, o clique em "remover" dentro da linha é lido
    // como início de arrasto e o botão nunca dispara.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = stops.findIndex((stop) => stop.id === active.id);
    const to = stops.findIndex((stop) => stop.id === over.id);
    if (from < 0 || to < 0) return;
    reorder.mutate({
      stopIds: arrayMove(stops, from, to).map((stop) => stop.id),
    });
  };

  const suggest = () => {
    if (!navigator.geolocation) {
      optimize.mutate({});
      return;
    }
    // A posição é um bônus, não um requisito: negar não pode travar o botão.
    navigator.geolocation.getCurrentPosition(
      (position) =>
        optimize.mutate({
          startLatitude: position.coords.latitude,
          startLongitude: position.coords.longitude,
        }),
      () => optimize.mutate({}),
      { timeout: 5000 },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Route className="size-4" />
            Minha rota
          </SheetTitle>
          <SheetDescription>
            {stops.length === 0
              ? "Clique num pino do mapa e use “Adicionar à minha rota”."
              : `${stops.length} parada(s) · ${(totalMeters / 1000).toFixed(1)} km em linha reta entre elas`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={stops.map((stop) => stop.id)}
                strategy={verticalListSortingStrategy}
              >
                <ol className="space-y-1.5">
                  {stops.map((stop, index) => (
                    <SortableStop
                      key={stop.id}
                      stop={stop}
                      index={index}
                      onRemove={() => removeStop.mutate({ stopId: stop.id })}
                      onFocus={() =>
                        onFocusStop?.({
                          latitude: stop.latitude,
                          longitude: stop.longitude,
                        })
                      }
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {stops.length > 0 && (
          <div className="flex flex-col gap-2 border-t p-4">
            <p className="text-xs text-muted-foreground">
              A distância é em linha reta entre as paradas, não quilometragem de
              rua. Serve para comparar ordens, não para medir o dia.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1 gap-1.5"
                disabled={optimize.isPending || stops.length < 3}
                onClick={suggest}
              >
                {optimize.isPending ? (
                  <Spinner />
                ) : (
                  <Crosshair className="size-4" />
                )}
                Sugerir melhor rota
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onFrameRoute?.();
                  toast.success("Rota enquadrada no mapa");
                }}
              >
                Enquadrar
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
