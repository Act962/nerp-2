"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Ban,
  BrickWall,
  DoorClosed,
  DoorOpen,
  Grid3x3,
  Hand,
  type LucideIcon,
  Magnet,
  Maximize,
  MapPin,
  MessageSquarePlus,
  MousePointer2,
  Package,
  RectangleHorizontal,
  Redo2,
  Rows3,
  ScanBarcode,
  SquareDashed,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useSceneStore } from "../engine/scene-store";
import { CREATE_TOOLS } from "../engine/tools";
import type { EditorTool, MapObjectType } from "../engine/types";
import type { SaveState } from "../hooks/use-floor-plan-scene";

const TYPE_ICONS: Record<MapObjectType, LucideIcon> = {
  WALL: BrickWall,
  AISLE: RectangleHorizontal,
  SECTOR: SquareDashed,
  GONDOLA: Rows3,
  ISLAND: RectangleHorizontal,
  CHECKOUT: ScanBarcode,
  ENTRANCE: DoorOpen,
  EXIT: DoorClosed,
  DEPOSIT: Package,
  RESTRICTED_AREA: Ban,
  PIN: MapPin,
  TEXT: RectangleHorizontal,
};

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  saving: "Salvando…",
  saved: "Salvo",
  error: "Erro ao salvar",
};

interface ToolButtonProps {
  active?: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}

function ToolButton({
  active,
  label,
  icon: Icon,
  onClick,
  disabled,
}: ToolButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="icon"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="size-4" />
    </Button>
  );
}

interface EditorToolbarProps {
  saveState: SaveState;
}

export function EditorToolbar({ saveState }: EditorToolbarProps) {
  const tool = useSceneStore((state) => state.tool);
  const setTool = useSceneStore((state) => state.setTool);
  const gridEnabled = useSceneStore((state) => state.gridEnabled);
  const toggleGrid = useSceneStore((state) => state.toggleGrid);
  const snapEnabled = useSceneStore((state) => state.snapEnabled);
  const toggleSnap = useSceneStore((state) => state.toggleSnap);
  const undo = useSceneStore((state) => state.undo);
  const redo = useSceneStore((state) => state.redo);
  const removeSelected = useSceneStore((state) => state.removeSelected);
  const selectedCount = useSceneStore((state) => state.selectedIds.length);
  const annotating = useSceneStore((state) => state.annotating);
  const setAnnotating = useSceneStore((state) => state.setAnnotating);
  const zoomByStep = useSceneStore((state) => state.zoomByStep);
  const fitToPlan = useSceneStore((state) => state.fitToPlan);
  const zoom = useSceneStore((state) => state.viewport.zoom);

  const setToolTo = (next: EditorTool) => () => setTool(next);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-background p-2">
      <ToolButton
        active={tool === "SELECT"}
        label="Selecionar (V)"
        icon={MousePointer2}
        onClick={setToolTo("SELECT")}
      />
      <ToolButton
        active={tool === "PAN"}
        label="Mover tela (espaço)"
        icon={Hand}
        onClick={setToolTo("PAN")}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      {CREATE_TOOLS.map((createTool) => (
        <ToolButton
          key={createTool.type}
          active={tool === createTool.type}
          label={createTool.label}
          icon={TYPE_ICONS[createTool.type]}
          onClick={setToolTo(createTool.type)}
        />
      ))}

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolButton
        active={gridEnabled}
        label="Grade"
        icon={Grid3x3}
        onClick={toggleGrid}
      />
      <ToolButton
        active={snapEnabled}
        label="Ajustar à grade"
        icon={Magnet}
        onClick={toggleSnap}
      />
      <ToolButton
        active={annotating}
        label="Anotação (pin/alerta/pendência)"
        icon={MessageSquarePlus}
        onClick={() => setAnnotating(!annotating)}
      />
      <ToolButton label="Desfazer (Ctrl+Z)" icon={Undo2} onClick={undo} />
      <ToolButton label="Refazer (Ctrl+Y)" icon={Redo2} onClick={redo} />
      <ToolButton
        label="Excluir seleção (Del)"
        icon={Trash2}
        onClick={removeSelected}
        disabled={selectedCount === 0}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolButton
        label="Diminuir zoom"
        icon={ZoomOut}
        onClick={() => zoomByStep(1 / 1.2)}
      />
      <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <ToolButton
        label="Aumentar zoom"
        icon={ZoomIn}
        onClick={() => zoomByStep(1.2)}
      />
      <ToolButton label="Enquadrar" icon={Maximize} onClick={fitToPlan} />

      <span
        className={cn(
          "ml-auto pr-2 text-xs",
          saveState === "error" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {SAVE_LABEL[saveState]}
      </span>
    </div>
  );
}
