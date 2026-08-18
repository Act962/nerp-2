"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Edit3,
  FolderOpen,
  Handshake,
  History,
  MoreVertical,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { boundsOf } from "../engine/geometry";
import { useSceneStore } from "../engine/scene-store";
import { useExportFloorPlanPdf } from "../hooks/use-floor-plan-export";
import { SpaceNegotiationDialog } from "./space-negotiation-dialog";
import { SpaceNegotiationHistory } from "./space-negotiation-history";

const DEFAULT_LABEL_FONT_M = 0.4;

interface SpaceActionMenuProps {
  hoveredId: string | null;
  floorPlanId: string;
  isAdmin: boolean;
  onKeepAlive: () => void;
  onScheduleHide: () => void;
}

function labelOf(name: string | null, spaceCode: string | null): string {
  return name || spaceCode || "Espaço";
}

export function SpaceActionMenu({
  hoveredId,
  floorPlanId,
  isAdmin,
  onKeepAlive,
  onScheduleHide,
}: SpaceActionMenuProps) {
  const objects = useSceneStore((state) => state.objects);
  const viewport = useSceneStore((state) => state.viewport);
  const ppm = useSceneStore((state) => state.floorPlan?.pixelsPerMeter ?? 50);
  const setSelection = useSceneStore((state) => state.setSelection);
  const removeObjects = useSceneStore((state) => state.removeObjects);
  const updateObject = useSceneStore((state) => state.updateObject);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [negotiationFor, setNegotiationFor] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [renameFor, setRenameFor] = useState<string | null>(null);
  const [deleteFor, setDeleteFor] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameFont, setRenameFont] = useState(DEFAULT_LABEL_FONT_M);

  const exportPdf = useExportFloorPlanPdf();

  // Mantém o botão enquanto o menu está aberto, mesmo sem hover.
  const activeId = hoveredId ?? menuFor;
  const active = activeId ? objects[activeId] : undefined;

  const openRename = (id: string) => {
    const target = objects[id];
    if (!target) return;
    setRenameName(target.name ?? "");
    setRenameFont(target.style.fontSize ?? DEFAULT_LABEL_FONT_M);
    setRenameFor(id);
  };

  const submitRename = () => {
    if (!renameFor) return;
    const target = objects[renameFor];
    if (target) {
      updateObject(renameFor, {
        name: renameName || null,
        style: { ...target.style, fontSize: renameFont },
      });
    }
    setRenameFor(null);
  };

  const confirmDelete = () => {
    if (deleteFor) removeObjects([deleteFor]);
    setDeleteFor(null);
  };

  const handlePrint = () => {
    exportPdf.mutate({ floorPlanId });
  };

  const button = (() => {
    if (!active) return null;
    const bounds = boundsOf(active.geometry);
    const scale = viewport.zoom * ppm;
    const left = bounds.maxX * scale + viewport.x;
    const top = bounds.minY * scale + viewport.y;
    const negotiationLabel = labelOf(active.name, active.spaceCode);

    return (
      <div
        className="absolute z-30"
        style={{ left, top, transform: "translate(-100%, 0)" }}
        onMouseEnter={onKeepAlive}
        onMouseLeave={onScheduleHide}
      >
        <DropdownMenu
          open={menuFor === active.id}
          onOpenChange={(open) => setMenuFor(open ? active.id : null)}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Ações do espaço"
              className="flex size-7 items-center justify-center rounded-md border bg-white text-neutral-700 shadow-sm hover:bg-neutral-100"
            >
              <MoreVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onCloseAutoFocus={onScheduleHide}>
            <DropdownMenuItem onSelect={() => setSelection([active.id])}>
              <FolderOpen className="size-4" />
              Abrir
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onSelect={() => setSelection([active.id])}>
                <Edit3 className="size-4" />
                Editar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setNegotiationFor(active.id)}>
              <Handshake className="size-4" />
              Criar negociação
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setHistoryFor(active.id)}>
              <History className="size-4" />
              Últimas negociações
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => openRename(active.id)}>
                  <Pencil className="size-4" />
                  Renomear
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setDeleteFor(active.id)}
                >
                  <Trash2 className="size-4" />
                  Excluir
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={handlePrint}
              disabled={exportPdf.isPending}
            >
              <Printer className="size-4" />
              Imprimir planta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  })();

  const negotiationObject = negotiationFor ? objects[negotiationFor] : undefined;
  const historyObject = historyFor ? objects[historyFor] : undefined;

  return (
    <>
      {button}

      {negotiationObject && (
        <SpaceNegotiationDialog
          mapObjectId={negotiationObject.id}
          spaceLabel={labelOf(negotiationObject.name, negotiationObject.spaceCode)}
          open={!!negotiationFor}
          onOpenChange={(open) => !open && setNegotiationFor(null)}
        />
      )}

      <SpaceNegotiationHistory
        mapObjectId={historyObject?.id ?? null}
        spaceLabel={
          historyObject
            ? labelOf(historyObject.name, historyObject.spaceCode)
            : ""
        }
        open={!!historyFor}
        onOpenChange={(open) => !open && setHistoryFor(null)}
      />

      <Dialog
        open={!!renameFor}
        onOpenChange={(open) => !open && setRenameFor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear espaço</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor="rename-name">Nome</FieldLabel>
              <Input
                id="rename-name"
                value={renameName}
                placeholder="Ex.: Gôndola A12"
                onChange={(event) => setRenameName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>
                Tamanho do rótulo ({renameFont.toFixed(1)} m)
              </FieldLabel>
              <Slider
                value={[renameFont]}
                min={0.2}
                max={2}
                step={0.1}
                onValueChange={([value]) => setRenameFont(value)}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameFor(null)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={submitRename}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteFor}
        onOpenChange={(open) => !open && setDeleteFor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir espaço</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação remove o elemento do mapa. Você pode desfazer com Ctrl+Z
            enquanto o editor estiver aberto.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteFor(null)}
            >
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete}>
              <Trash2 className="size-4" />
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
