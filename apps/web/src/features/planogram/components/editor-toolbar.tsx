"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Layers,
  Palette,
  Plus,
  Printer,
  Redo2,
  Save,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { usePlanogramStore } from "../engine/planogram-store-context";
import type { SaveState } from "../hooks/use-planogram-autosave";

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  saving: "Salvando…",
  saved: "Salvo",
  error: "Erro ao salvar — tentando de novo",
};

interface EditorToolbarProps {
  saveState: SaveState;
  onCreateFixture: () => void;
  onSaveVersion: () => void;
  isSavingVersion: boolean;
}

export function EditorToolbar({
  saveState,
  onCreateFixture,
  onSaveVersion,
  isSavingVersion,
}: EditorToolbarProps) {
  const view = usePlanogramStore((state) => state.view);
  const setView = usePlanogramStore((state) => state.setView);
  const undo = usePlanogramStore((state) => state.undo);
  const redo = usePlanogramStore((state) => state.redo);
  const canUndo = usePlanogramStore((state) => state.past.length > 0);
  const canRedo = usePlanogramStore((state) => state.future.length > 0);

  const activeFixtureId = usePlanogramStore((state) => state.activeFixtureId);
  const order = usePlanogramStore((state) => state.order);
  const activeModuleIndex = usePlanogramStore(
    (state) => state.activeModuleIndex,
  );
  const setActiveModuleIndex = usePlanogramStore(
    (state) => state.setActiveModuleIndex,
  );
  const addModule = usePlanogramStore((state) => state.addModule);

  const moduleIds = activeFixtureId
    ? (order.modulesByFixture[activeFixtureId] ?? [])
    : [];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
      <Button
        size="sm"
        variant="outline"
        className="gap-2"
        onClick={onCreateFixture}
      >
        <Plus className="size-4" />
        Criar gôndola
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button
        size="icon"
        variant="ghost"
        disabled={!canUndo}
        onClick={undo}
        title="Desfazer (Ctrl+Z)"
      >
        <Undo2 className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        disabled={!canRedo}
        onClick={redo}
        title="Refazer (Ctrl+Shift+Z)"
      >
        <Redo2 className="size-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button
        size="icon"
        variant="ghost"
        onClick={() =>
          setView({ zoomLevel: Math.max(0.5, view.zoomLevel - 0.25) })
        }
        title="Diminuir zoom"
      >
        <ZoomOut className="size-4" />
      </Button>
      <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(view.zoomLevel * 100)}%
      </span>
      <Button
        size="icon"
        variant="ghost"
        onClick={() =>
          setView({ zoomLevel: Math.min(4, view.zoomLevel + 0.25) })
        }
        title="Aumentar zoom"
      >
        <ZoomIn className="size-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {moduleIds.length > 0 && (
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            disabled={activeModuleIndex === 0}
            onClick={() => setActiveModuleIndex(activeModuleIndex - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Módulo {activeModuleIndex + 1}/{moduleIds.length}
          </span>
          <Button
            size="icon"
            variant="ghost"
            disabled={activeModuleIndex >= moduleIds.length - 1}
            onClick={() => setActiveModuleIndex(activeModuleIndex + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Adicionar módulo"
            onClick={() => activeFixtureId && addModule(activeFixtureId)}
          >
            <Layers className="size-4" />
          </Button>
        </div>
      )}

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1.5 text-xs">
        <Switch
          checked={view.showColors}
          onCheckedChange={(checked) => setView({ showColors: checked })}
        />
        <Palette className="size-3.5" />
        Cores
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <Switch
          checked={view.showBackground}
          onCheckedChange={(checked) => setView({ showBackground: checked })}
        />
        <ImageIcon className="size-3.5" />
        Fundo
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <Switch
          checked={view.showEans}
          onCheckedChange={(checked) => setView({ showEans: checked })}
        />
        EANs
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span
          className={`text-xs ${saveState === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {SAVE_LABEL[saveState]}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={isSavingVersion}
          onClick={onSaveVersion}
        >
          <Save className="size-4" />
          Salvar no histórico
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => window.print()}
        >
          <Printer className="size-4" />
          Imprimir
        </Button>
      </div>
    </div>
  );
}
