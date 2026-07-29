"use client";

import {
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { pastelHex } from "../lib/pastel-colors";

// Classe usada como seletor de "alça de arraste" no dragConfig.handle do
// ResponsiveGridLayout — sem isso o card inteiro vira alça e clicar em
// qualquer botão dentro do widget dispararia um arraste.
export const WIDGET_DRAG_HANDLE_CLASS = "widget-drag-handle";

/** "há 3 min" a partir do carimbo do snapshot. */
function formatAge(computedAt: string): string {
  const minutes = Math.floor(
    (Date.now() - new Date(computedAt).getTime()) / 60_000,
  );
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

export function WidgetFrame({
  title,
  color,
  onRemove,
  onEdit,
  onRefresh,
  onOpenDetail,
  onToggleCollapse,
  collapsed,
  draggable = true,
  refreshing,
  computedAt,
  editable,
  children,
}: {
  title: string;
  color?: string | null;
  onRemove?: () => void;
  onEdit?: () => void;
  onRefresh?: () => void;
  /** Clique no corpo do card abre o detalhamento dos dados. */
  onOpenDetail?: () => void;
  /** Esticar/retrair — usado no mobile, onde não há como redimensionar. */
  onToggleCollapse?: () => void;
  collapsed?: boolean;
  /** No mobile o arraste é desligado; sem isso a alça ocupa espaço à toa. */
  draggable?: boolean;
  refreshing?: boolean;
  /** Carimbo do snapshot (widgets de consulta ao Oracle). */
  computedAt?: string | null;
  editable?: boolean;
  children: ReactNode;
}) {
  const hex = pastelHex(color);

  // Mesmo botão em dois lugares conforme o estado. Esticado ele flutua no
  // canto inferior direito (pedido do usuário, e no alcance do polegar).
  // Retraído o card tem só a altura do cabeçalho, então "canto inferior" e
  // "cabeçalho" viram o mesmo ponto: flutuando ali ele cobriria o X de
  // remover. Nesse caso entra em linha, junto dos outros botões.
  const toggleButton = onToggleCollapse ? (
    <Button
      type="button"
      size="icon-sm"
      variant={collapsed ? "ghost" : "secondary"}
      onClick={(event) => {
        // O corpo do card abre o detalhamento no clique.
        event.stopPropagation();
        onToggleCollapse();
      }}
      title={collapsed ? "Esticar" : "Retrair"}
      className={cn(
        "shrink-0",
        collapsed
          ? "text-muted-foreground hover:text-foreground"
          : "absolute bottom-1.5 right-1.5 z-10 size-7 rounded-full border shadow-sm",
      )}
    >
      {collapsed ? (
        <ChevronsUpDown className="size-3.5" />
      ) : (
        <ChevronsDownUp className="size-3.5" />
      )}
    </Button>
  ) : null;

  return (
    <Card
      className="relative h-full overflow-hidden pt-0 gap-0"
      style={
        hex
          ? { background: `${hex}18`, borderTopColor: hex, borderTopWidth: 3 }
          : undefined
      }
    >
      <CardHeader
        className={cn(
          "flex flex-row items-center gap-1.5 py-2",
          editable && draggable && WIDGET_DRAG_HANDLE_CLASS,
          editable && draggable && "cursor-grab active:cursor-grabbing",
        )}
      >
        {editable && draggable && (
          <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <CardTitle className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {editable && onRefresh && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onRefresh}
            disabled={refreshing}
            title={
              computedAt
                ? `Atualizado ${formatAge(computedAt)} — clique para atualizar`
                : "Atualizar agora"
            }
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw
              className={cn("size-3.5", refreshing && "animate-spin")}
            />
          </Button>
        )}
        {editable && onEdit && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onEdit}
            title="Personalizar widget"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="size-3.5" />
          </Button>
        )}
        {editable && onRemove && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onRemove}
            title="Remover widget"
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <X className="size-3.5" />
          </Button>
        )}
        {collapsed && toggleButton}
      </CardHeader>
      {/* Corpo clicável abre o detalhamento. Fica FORA do cabeçalho de
        propósito: o cabeçalho é a alça de arraste e tem os botões de ação, e
        um clique ali não pode virar popup. Continua uma div (não button) para
        não invalidar o HTML — gráficos e tabelas dentro têm elementos
        interativos próprios. */}
      {/* Retraído esconde o conteúdo inteiro em vez de encolher: espremer um
        pódio ou uma tabela em 60px é exatamente o que quebrava o layout. */}
      <CardContent
        className={cn(
          "min-h-0 flex-1 overflow-hidden p-3",
          onOpenDetail && "cursor-pointer",
          collapsed && "hidden",
        )}
        onClick={onOpenDetail}
        onKeyDown={(event) => {
          if (!onOpenDetail) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenDetail();
          }
        }}
        role={onOpenDetail ? "button" : undefined}
        tabIndex={onOpenDetail ? 0 : undefined}
      >
        {children}
      </CardContent>

      {!collapsed && toggleButton}
    </Card>
  );
}
