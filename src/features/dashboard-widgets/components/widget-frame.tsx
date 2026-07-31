"use client";

import {
  BellRing,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { pastelHex, type WidgetColor } from "../lib/pastel-colors";
import {
  alignClass,
  titleSizeClass,
  weightClass,
  type WidgetAlign,
  type WidgetBackground,
  type WidgetBorder,
  type WidgetTextSize,
  type WidgetTextWeight,
} from "../lib/widget-appearance";

// Classe usada como seletor de "alça de arraste" no dragConfig.handle do
// ResponsiveGridLayout — sem isso o card inteiro vira alça e clicar em
// qualquer botão dentro do widget dispararia um arraste.
export const WIDGET_DRAG_HANDLE_CLASS = "widget-drag-handle";

// Botões de ação ficam DENTRO do cabeçalho, que é a alça de arraste. No touch,
// o react-draggable chama preventDefault no touchstart de tudo que cai na alça
// (para não rolar a página durante o arraste), e isso engole o toque antes de
// virar clique — no mobile o botão de engrenagem e o de retrair simplesmente
// não respondiam. Esta classe entra no dragConfig.cancel: o que a tiver aborta
// o início do arraste e volta a receber o toque como clique normal.
export const WIDGET_NO_DRAG_CLASS = "widget-no-drag";

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
  titleAlign = "left",
  titleColor,
  titleSize = "sm",
  titleWeight = "medium",
  color,
  alertColor,
  alertMessage,
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
  background = "tint",
  border = "top",
  borderColor,
  children,
}: {
  title: string;
  /** Alinhamento do texto do título no cabeçalho. */
  titleAlign?: WidgetAlign;
  /** Cor do título: chave da paleta OU hex livre. null = tom padrão do tema. */
  titleColor?: WidgetColor | null;
  /** Escala de fonte do título. `sm` = comportamento antigo. */
  titleSize?: WidgetTextSize;
  /** Peso do título. `medium` = comportamento antigo. */
  titleWeight?: WidgetTextWeight;
  color?: string | null;
  /** Cor do card enquanto um alerta está ativo. Sobrepõe `color`. */
  alertColor?: WidgetColor | null;
  /** Mensagem do alerta ativo — mostrada como badge no cabeçalho. */
  alertMessage?: string | null;
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
  /** Fundo lavado na cor (`tint`) ou sem fundo (`none`, visual escuro). */
  background?: WidgetBackground;
  /** Contorno: topo grosso (`top`), fino completo (`full`) ou nenhum. */
  border?: WidgetBorder;
  /** Cor do contorno; null = deriva de `color`. */
  borderColor?: WidgetColor | null;
  children: ReactNode;
}) {
  const titleHex = pastelHex(titleColor);
  const alertHex = pastelHex(alertColor);
  const colorHex = pastelHex(color);
  // Cor do contorno: explícita > cor do card. Alerta sempre vence tudo.
  const borderHex = pastelHex(borderColor) ?? colorHex;

  // Fundo: alerta ativo SEMPRE lava o card (o gerente vê o alerta antes da
  // estética). Fora de alerta, respeita o modo — `tint` = lavado (9%), `none`
  // = sem fundo (herda o card escuro do tema, base do visual control center).
  const cardStyle: CSSProperties = {};
  if (alertHex) cardStyle.background = `${alertHex}38`;
  else if (background === "tint" && colorHex)
    cardStyle.background = `${colorHex}18`;

  // Contorno: alerta = topo 4px na cor do alerta. Senão, o modo escolhido.
  const noBorder = !alertHex && border === "none";
  if (alertHex) {
    cardStyle.borderTopColor = alertHex;
    cardStyle.borderTopWidth = 4;
  } else if (border === "full" && borderHex) {
    cardStyle.borderColor = borderHex;
    cardStyle.borderWidth = 1;
  } else if (border === "top" && borderHex) {
    cardStyle.borderTopColor = borderHex;
    cardStyle.borderTopWidth = 3;
  }

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
        WIDGET_NO_DRAG_CLASS,
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
      className={cn(
        "relative h-full overflow-hidden pt-0 gap-0",
        noBorder && "border-0",
      )}
      style={cardStyle}
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
        {alertHex && (
          <span
            role="img"
            title={alertMessage ?? "Alerta ativo"}
            aria-label={alertMessage ?? "Alerta ativo"}
            className="flex size-5 shrink-0 items-center justify-center rounded-full"
            style={{ background: alertHex, color: "#ffffff" }}
          >
            <BellRing className="size-3" />
          </span>
        )}
        <CardTitle
          className={cn(
            "min-w-0 flex-1 truncate",
            titleSizeClass(titleSize),
            weightClass(titleWeight),
            !titleHex && "text-muted-foreground",
            alignClass(titleAlign),
          )}
          style={titleHex ? { color: titleHex } : undefined}
        >
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
            className={cn(
              WIDGET_NO_DRAG_CLASS,
              "shrink-0 text-muted-foreground hover:text-foreground",
            )}
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
            className={cn(
              WIDGET_NO_DRAG_CLASS,
              "shrink-0 text-muted-foreground hover:text-foreground",
            )}
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
            className={cn(
              WIDGET_NO_DRAG_CLASS,
              "shrink-0 text-muted-foreground hover:text-destructive",
            )}
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
