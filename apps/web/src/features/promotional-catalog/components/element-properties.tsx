"use client";

import {
  FlipHorizontal,
  FlipVertical,
  BringToFront,
  SendToBack,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { Overlay } from "../types";

interface ElementPropertiesProps {
  overlay: Overlay;
  onChange: (patch: Partial<Overlay>) => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onDelete: () => void;
  canForward: boolean;
  canBackward: boolean;
}

// Propriedades do Elemento (etiqueta) selecionado — Fase 4 do editor Canva.
// Transparência, arredondamento, contorno, inverter, camadas (z-order) e girar.
export function ElementProperties({
  overlay,
  onChange,
  onBringForward,
  onSendBackward,
  onDelete,
  canForward,
  canBackward,
}: ElementPropertiesProps) {
  const opacity = overlay.opacity ?? 100;
  const radius = overlay.radius ?? 0;
  const borderWidth = overlay.borderWidth ?? 0;
  const borderColor = overlay.borderColor ?? "#000000";
  const rotation = ((overlay.rotation % 360) + 360) % 360;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-foreground">
          Propriedades do elemento
        </p>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          title="Excluir elemento"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Preenchimento — só para FORMAS preenchidas (moldura usa o contorno) */}
      {overlay.shape && overlay.shape !== "frame" && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Preenchimento</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={overlay.fill ?? "#111111"}
              onChange={(e) => onChange({ fill: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded border bg-background"
              title="Cor de preenchimento"
            />
            <span className="text-xs text-muted-foreground">cor da forma</span>
          </div>
        </div>
      )}

      {/* Transparência */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Transparência</Label>
          <span className="text-xs text-muted-foreground">{opacity}%</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[opacity]}
          onValueChange={([v]) => onChange({ opacity: v })}
        />
      </div>

      {/* Arredondamento de canto */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Arredondamento</Label>
          <span className="text-xs text-muted-foreground">{radius}px</span>
        </div>
        <Slider
          min={0}
          max={200}
          step={2}
          value={[radius]}
          onValueChange={([v]) => onChange({ radius: v })}
        />
      </div>

      {/* Contorno */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Contorno</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={40}
            value={borderWidth}
            onChange={(e) =>
              onChange({
                borderWidth: Math.min(
                  40,
                  Math.max(0, Number(e.target.value) || 0),
                ),
              })
            }
            className="h-8 w-20"
            title="Espessura (px)"
          />
          <input
            type="color"
            value={borderColor}
            onChange={(e) => onChange({ borderColor: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded border bg-background"
            title="Cor do contorno"
          />
          <span className="text-xs text-muted-foreground">px · cor</span>
        </div>
      </div>

      {/* Girar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Girar</Label>
          <span className="text-xs text-muted-foreground">{rotation}°</span>
        </div>
        <Slider
          min={0}
          max={359}
          step={1}
          value={[rotation]}
          onValueChange={([v]) => onChange({ rotation: v })}
        />
      </div>

      {/* Inverter */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Inverter</Label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={overlay.flipH ? "secondary" : "outline"}
            className={cn(
              "h-8 flex-1 gap-1",
              overlay.flipH && "border-primary",
            )}
            onClick={() => onChange({ flipH: !overlay.flipH })}
          >
            <FlipHorizontal className="h-4 w-4" />
            Horizontal
          </Button>
          <Button
            size="sm"
            variant={overlay.flipV ? "secondary" : "outline"}
            className={cn(
              "h-8 flex-1 gap-1",
              overlay.flipV && "border-primary",
            )}
            onClick={() => onChange({ flipV: !overlay.flipV })}
          >
            <FlipVertical className="h-4 w-4" />
            Vertical
          </Button>
        </div>
      </div>

      {/* Camadas (z-order) */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Camadas</Label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 flex-1 gap-1"
            disabled={!canForward}
            onClick={onBringForward}
          >
            <BringToFront className="h-4 w-4" />
            Frente
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 flex-1 gap-1"
            disabled={!canBackward}
            onClick={onSendBackward}
          >
            <SendToBack className="h-4 w-4" />
            Trás
          </Button>
        </div>
        {/* Frente/Trás só reordenam entre ELEMENTOS. Os produtos são desenhados
            numa camada própria, antes deles — para uma forma virar faixa de
            fundo é preciso mandá-la para trás dos produtos explicitamente. */}
        <Button
          size="sm"
          variant={overlay.behindProducts ? "default" : "outline"}
          className="h-8 w-full gap-1"
          onClick={() => onChange({ behindProducts: !overlay.behindProducts })}
        >
          <SendToBack className="h-4 w-4" />
          {overlay.behindProducts
            ? "Atrás dos produtos"
            : "Enviar para trás dos produtos"}
        </Button>
      </div>
    </div>
  );
}
