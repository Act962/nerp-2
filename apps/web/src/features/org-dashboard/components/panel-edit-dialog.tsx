"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorSwatchPicker } from "@/features/dashboard-widgets/components/widget-customize-fields";
import type { WidgetColor } from "@/features/dashboard-widgets/lib/pastel-colors";
import {
  TEXT_SIZE_LABEL,
  TEXT_WEIGHT_LABEL,
  type WidgetBackground,
  type WidgetBorder,
  type WidgetTextSize,
  type WidgetTextWeight,
} from "@/features/dashboard-widgets/lib/widget-appearance";
import { useUpdateOrgPanel } from "../hooks/use-org-dashboard";
import {
  type PanelAppearance,
  hasCustomPanelAppearance,
  readPanelAppearance,
} from "../lib/panel-appearance";

interface PanelEditTarget {
  id: string;
  title: string;
  color: string | null;
  appearance?: unknown;
  boardId?: string | null;
}

interface BoardOption {
  id: string;
  title: string;
}

export function PanelEditDialog({
  panel,
  boards,
  onOpenChange,
}: {
  panel: PanelEditTarget | null;
  boards?: BoardOption[];
  onOpenChange: (open: boolean) => void;
}) {
  if (!panel) return null;
  return (
    <PanelEditForm
      key={panel.id}
      panel={panel}
      boards={boards}
      onOpenChange={onOpenChange}
    />
  );
}

function PanelEditForm({
  panel,
  boards,
  onOpenChange,
}: {
  panel: PanelEditTarget;
  boards?: BoardOption[];
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateOrgPanel();
  const [title, setTitle] = useState(panel.title);
  const [color, setColor] = useState<WidgetColor | null>(
    panel.color as WidgetColor | null,
  );
  const [boardId, setBoardId] = useState<string | null>(panel.boardId ?? null);
  const [appearance, setAppearance] = useState<PanelAppearance>(
    readPanelAppearance(panel.appearance),
  );

  const patch = (next: Partial<PanelAppearance>) =>
    setAppearance((current) => ({ ...current, ...next }));

  const save = () => {
    update.mutate(
      {
        panelId: panel.id,
        title: title.trim() || "Painel",
        color,
        boardId,
        appearance: hasCustomPanelAppearance(appearance)
          ? (appearance as unknown as Record<string, unknown>)
          : null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar painel</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] text-muted-foreground">Título</Label>
            <Input
              className="h-8 text-sm"
              maxLength={60}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          {boards && boards.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] text-muted-foreground">
                Quadro
              </Label>
              <Select
                value={boardId ?? "__none__"}
                onValueChange={(value) =>
                  setBoardId(value === "__none__" ? null : value)
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum (solto)</SelectItem>
                  {boards.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] text-muted-foreground">
              Cor de acento
            </Label>
            <ColorSwatchPicker value={color} onChange={setColor} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={appearance.background}
              onValueChange={(value) =>
                patch({ background: value as WidgetBackground })
              }
            >
              <SelectTrigger className="h-7 w-36 text-xs" aria-label="Fundo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tint">Fundo colorido</SelectItem>
                <SelectItem value="none">Sem fundo</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={appearance.border}
              onValueChange={(value) =>
                patch({ border: value as WidgetBorder })
              }
            >
              <SelectTrigger className="h-7 w-36 text-xs" aria-label="Contorno">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Contorno no topo</SelectItem>
                <SelectItem value="full">Contorno completo</SelectItem>
                <SelectItem value="none">Sem contorno</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {appearance.background === "tint" && (
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground">
                Cor do fundo
              </Label>
              <ColorSwatchPicker
                value={appearance.backgroundColor}
                onChange={(backgroundColor) => patch({ backgroundColor })}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground">
              Cor do contorno
            </Label>
            <ColorSwatchPicker
              value={appearance.borderColor}
              onChange={(borderColor) => patch({ borderColor })}
            />
          </div>

          <div className="flex flex-col gap-2 border-t pt-3">
            <Label className="text-[10px] text-muted-foreground">
              Título do painel
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={appearance.titleSize}
                onValueChange={(value) =>
                  patch({ titleSize: value as WidgetTextSize })
                }
              >
                <SelectTrigger
                  className="h-7 w-28 text-xs"
                  aria-label="Tamanho"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TEXT_SIZE_LABEL) as WidgetTextSize[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {TEXT_SIZE_LABEL[key]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <Select
                value={appearance.titleWeight}
                onValueChange={(value) =>
                  patch({ titleWeight: value as WidgetTextWeight })
                }
              >
                <SelectTrigger className="h-7 w-28 text-xs" aria-label="Peso">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TEXT_WEIGHT_LABEL) as WidgetTextWeight[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {TEXT_WEIGHT_LABEL[key]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <ColorSwatchPicker
                value={appearance.titleColor}
                onChange={(titleColor) => patch({ titleColor })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" disabled={update.isPending} onClick={save}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
