"use client";

import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { widgetIcon } from "../lib/widget-icons";
import { formatWidgetValue, type WidgetValue } from "../lib/widget-value";

// Mensagem que o resolver devolve quando ainda não há snapshot: NÃO é um erro
// de verdade, é o widget calculando pela primeira vez. Precisa bater com o
// literal usado em _oracle-custom.ts.
const CALCULATING_MARKER = "Calculando…";

export interface ChildWidget {
  id: string;
  title: string;
  icon?: string | null;
  value: WidgetValue | null | undefined;
  error?: string | null;
}

/** Um valor de qualquer WidgetValue, achatado para caber numa linha. */
function compactValue(value: WidgetValue | null | undefined): string {
  if (!value) return "—";
  switch (value.kind) {
    case "STAT":
      return formatWidgetValue(value.value, value.unit);
    case "CHART": {
      // Série inteira não cabe: mostra o total, que é o que interessa resumido.
      const total = value.series.reduce((sum, point) => sum + point.value, 0);
      return formatWidgetValue(total);
    }
    case "LIST": {
      const total = value.items.reduce((sum, item) => sum + item.value, 0);
      return formatWidgetValue(total, value.items[0]?.unit);
    }
    case "MAP": {
      const total = value.regions.reduce((sum, item) => sum + item.value, 0);
      return formatWidgetValue(total, "currency");
    }
    case "TABLE":
      return `${value.rows.length} linha(s)`;
    case "FLEET":
      return `${value.trucks.length} caminhão(ões)`;
    case "FEED":
      return `${value.items.length} alerta(s)`;
  }
}

// Desdobramentos dentro do card do pai — "Venda total" em cima, "Filial X" e
// "Filial Y" embaixo, cada um com consulta e filtro próprios.
//
// A responsividade é resolvida por `@container`, não por breakpoint de tela: o
// que manda é a largura DO CARD, que muda quando o usuário redimensiona na
// grade. Um card estreito empilha em 1 coluna; conforme cresce, vai para 2 e
// depois 3 — sem nunca estourar o layout.
export function WidgetChildren({
  items,
  editable,
  onRemove,
}: {
  items: ChildWidget[];
  editable?: boolean;
  onRemove?: (childId: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="@container mt-2 border-t pt-2">
      <div className="grid grid-cols-1 gap-x-3 gap-y-1.5 @[15rem]:grid-cols-2 @[26rem]:grid-cols-3">
        {items.map((child) => {
          const Icon = widgetIcon(child.icon);
          return (
            <div
              key={child.id}
              className="group/child flex min-w-0 items-center gap-1.5"
            >
              {Icon && (
                <Icon className="size-3 shrink-0 text-muted-foreground" />
              )}
              <span
                className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground"
                title={child.title}
              >
                {child.title}
              </span>
              {(() => {
                // "Calculando…" acontece no primeiro carregamento de uma
                // consulta Oracle, antes do snapshot existir. Antes caía no
                // ramo de erro e o desdobramento aparecia como "erro" —
                // usuário lia como bug ("as informações não estão indo para
                // dentro do widget") em vez de "ainda vou terminar". O top-
                // level já diferenciava; o desdobramento não.
                const isCalculating = child.error === CALCULATING_MARKER;
                const isRealError = !!child.error && !isCalculating;

                if (isCalculating) {
                  return (
                    <span
                      className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground"
                      title="Calculando pela primeira vez — reabra em alguns segundos."
                    >
                      <Loader2 className="size-3 animate-spin" />
                      calculando
                    </span>
                  );
                }

                return (
                  <span
                    className={cn(
                      "shrink-0 font-semibold text-xs tabular-nums",
                      isRealError && "text-destructive",
                    )}
                    title={child.error ?? undefined}
                  >
                    {isRealError ? "erro" : compactValue(child.value)}
                  </span>
                );
              })()}
              {editable && onRemove && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  title="Remover desdobramento"
                  // Só aparece no hover: em card pequeno, um × fixo por linha
                  // rouba espaço do que importa (o número).
                  className="size-4 shrink-0 opacity-0 transition-opacity group-hover/child:opacity-100"
                  onClick={(event) => {
                    // O card inteiro abre o detalhamento no clique.
                    event.stopPropagation();
                    onRemove(child.id);
                  }}
                >
                  <X className="size-2.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
