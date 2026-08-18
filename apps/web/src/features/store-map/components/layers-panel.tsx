"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useSceneStore } from "../engine/scene-store";
import { useMapLayerMutations } from "../hooks/use-map-layers";

interface LayersPanelProps {
  floorPlanId: string;
}

export function LayersPanel({ floorPlanId }: LayersPanelProps) {
  const layers = useSceneStore((state) => state.layers);
  const objects = useSceneStore((state) => state.objects);
  const activeLayerId = useSceneStore((state) => state.activeLayerId);
  const setActiveLayer = useSceneStore((state) => state.setActiveLayer);
  const updateLayer = useSceneStore((state) => state.updateLayer);
  const addLayer = useSceneStore((state) => state.addLayer);
  const removeLayer = useSceneStore((state) => state.removeLayer);

  const { create, update, remove } = useMapLayerMutations();

  const countByLayer = useMemo(() => {
    const counts = new Map<string, number>();
    for (const object of Object.values(objects)) {
      counts.set(object.layerId, (counts.get(object.layerId) ?? 0) + 1);
    }
    return counts;
  }, [objects]);

  const handleToggleVisible = (id: string, visible: boolean) => {
    updateLayer(id, { visible });
    update.mutate({ id, visible });
  };

  const handleToggleLock = (id: string, locked: boolean) => {
    updateLayer(id, { locked });
    update.mutate({ id, locked });
  };

  const handleAdd = () => {
    const layer = addLayer("Nova camada");
    create.mutate({
      id: layer.id,
      floorPlanId,
      name: layer.name,
      order: layer.order,
    });
  };

  const handleRemove = (id: string) => {
    removeLayer(id);
    remove.mutate({ id });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-3">
        <h3 className="text-sm font-semibold">Camadas</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title="Adicionar camada"
          onClick={handleAdd}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {layers.map((layer) => {
          const isActive = layer.id === activeLayerId;
          const count = countByLayer.get(layer.id) ?? 0;
          return (
            <div
              key={layer.id}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
                isActive ? "bg-accent" : "hover:bg-accent/50",
              )}
            >
              <button
                type="button"
                className="flex flex-1 items-center gap-2 text-left"
                onClick={() => setActiveLayer(layer.id)}
              >
                <span className="flex-1 truncate">{layer.name}</span>
                <span className="text-xs text-muted-foreground">{count}</span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                title={layer.visible ? "Ocultar" : "Mostrar"}
                onClick={() => handleToggleVisible(layer.id, !layer.visible)}
              >
                {layer.visible ? (
                  <Eye className="size-4" />
                ) : (
                  <EyeOff className="size-4 text-muted-foreground" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                title={layer.locked ? "Desbloquear" : "Bloquear"}
                onClick={() => handleToggleLock(layer.id, !layer.locked)}
              >
                {layer.locked ? (
                  <Lock className="size-4 text-muted-foreground" />
                ) : (
                  <LockOpen className="size-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-destructive"
                title="Excluir camada"
                onClick={() => handleRemove(layer.id)}
                disabled={layers.length <= 1}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
