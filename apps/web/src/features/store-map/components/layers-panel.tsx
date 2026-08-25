"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Check,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
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
  const setSelection = useSceneStore((state) => state.setSelection);
  const setTool = useSceneStore((state) => state.setTool);

  const { create, update, remove } = useMapLayerMutations();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  // Clicar no setor seleciona todas as gôndolas dele (e o deixa ativo).
  const handleSelectLayer = (id: string) => {
    setActiveLayer(id);
    setTool("SELECT");
    setSelection(
      Object.values(objects)
        .filter((object) => object.layerId === id)
        .map((object) => object.id),
    );
  };

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setDraftName(name);
  };

  const commitRename = () => {
    if (!editingId) return;
    const name = draftName.trim();
    if (name) {
      updateLayer(editingId, { name });
      update.mutate({ id: editingId, name });
    }
    setEditingId(null);
  };

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
    const layer = addLayer("Novo setor");
    create.mutate({
      id: layer.id,
      floorPlanId,
      name: layer.name,
      order: layer.order,
    });
    startRename(layer.id, layer.name);
  };

  const handleRemove = (id: string) => {
    removeLayer(id);
    remove.mutate({ id });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-3">
        <h3 className="text-sm font-semibold">Setores</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title="Adicionar setor"
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
              {editingId === layer.id ? (
                <Input
                  autoFocus
                  value={draftName}
                  className="h-7 flex-1"
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitRename();
                    if (event.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 text-left"
                  title="Selecionar as gôndolas deste setor"
                  onClick={() => handleSelectLayer(layer.id)}
                >
                  <span className="flex-1 truncate">{layer.name}</span>
                  <span className="text-xs text-muted-foreground">{count}</span>
                </button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                title="Renomear setor"
                onClick={() =>
                  editingId === layer.id
                    ? commitRename()
                    : startRename(layer.id, layer.name)
                }
              >
                {editingId === layer.id ? (
                  <Check className="size-4" />
                ) : (
                  <Pencil className="size-4" />
                )}
              </Button>
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
                title="Excluir setor"
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
