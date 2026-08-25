"use client";

import {
  SlidersHorizontal,
  FlipHorizontal,
  FlipVertical,
  BringToFront,
  SendToBack,
  Layers,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignCenter,
  Copy,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Overlay } from "../types";
import { ElementProperties } from "./element-properties";

export type AlignEdge =
  | "left"
  | "hcenter"
  | "right"
  | "top"
  | "vcenter"
  | "bottom";

interface ElementToolbarProps {
  overlay: Overlay;
  onChange: (patch: Partial<Overlay>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  canForward: boolean;
  canBackward: boolean;
  onAlign: (edge: AlignEdge) => void;
}

// Barra flutuante do elemento (estilo Canva) — aparece sobre a etiqueta
// selecionada. Reúne os instrumentos aplicáveis: Editar (cores/contorno/raio/
// transparência/girar), Inverter, Camadas (z-order), Alinhar, Duplicar, Excluir.
export function ElementToolbar({
  overlay,
  onChange,
  onDuplicate,
  onDelete,
  onBringForward,
  onSendBackward,
  canForward,
  canBackward,
  onAlign,
}: ElementToolbarProps) {
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border bg-background px-1 py-1 shadow-lg"
      onPointerDown={stop}
    >
      {/* Editar (propriedades completas) */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Editar
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Cores, contorno, raio, transparência…</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-72 p-3">
          <ElementProperties
            overlay={overlay}
            onChange={onChange}
            onBringForward={onBringForward}
            onSendBackward={onSendBackward}
            onDelete={onDelete}
            canForward={canForward}
            canBackward={canBackward}
          />
        </PopoverContent>
      </Popover>

      <div className="mx-0.5 h-5 w-px bg-border" />

      {/* Inverter */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <FlipHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Inverter</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onChange({ flipH: !overlay.flipH })}>
            <FlipHorizontal className="mr-2 h-4 w-4" />
            Inverter horizontal
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChange({ flipV: !overlay.flipV })}>
            <FlipVertical className="mr-2 h-4 w-4" />
            Inverter vertical
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Camadas (z-order) */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Layers className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Camadas</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start">
          <DropdownMenuItem disabled={!canForward} onClick={onBringForward}>
            <BringToFront className="mr-2 h-4 w-4" />
            Trazer para a frente
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canBackward} onClick={onSendBackward}>
            <SendToBack className="mr-2 h-4 w-4" />
            Enviar para trás
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Alinhar à página */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <AlignCenter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Alinhar à página</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onAlign("left")}>
            <AlignHorizontalJustifyStart className="mr-2 h-4 w-4" />
            Esquerda
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAlign("hcenter")}>
            <AlignHorizontalJustifyCenter className="mr-2 h-4 w-4" />
            Centro (horizontal)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAlign("right")}>
            <AlignHorizontalJustifyEnd className="mr-2 h-4 w-4" />
            Direita
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onAlign("top")}>
            <AlignVerticalJustifyStart className="mr-2 h-4 w-4" />
            Topo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAlign("vcenter")}>
            <AlignVerticalJustifyCenter className="mr-2 h-4 w-4" />
            Meio (vertical)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAlign("bottom")}>
            <AlignVerticalJustifyEnd className="mr-2 h-4 w-4" />
            Base
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-0.5 h-5 w-px bg-border" />

      {/* Duplicar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onDuplicate}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Duplicar</TooltipContent>
      </Tooltip>

      {/* Excluir */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Excluir</TooltipContent>
      </Tooltip>

      {/* Menu "..." */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicar
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canForward} onClick={onBringForward}>
            <BringToFront className="mr-2 h-4 w-4" />
            Trazer para a frente
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canBackward} onClick={onSendBackward}>
            <SendToBack className="mr-2 h-4 w-4" />
            Enviar para trás
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
