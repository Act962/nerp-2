"use client";

import { cn } from "@/lib/utils";
import type { WidgetTone, WidgetValue } from "../../lib/widget-value";

// Cores por tom — compartilhado com o FeedWidget via toneBadgeClass. Tons
// semânticos em vez de cor livre para o mesmo status ler igual em todo card.
const TONE_BADGE: Record<WidgetTone, string> = {
  info: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  danger: "bg-red-500/15 text-red-600 dark:text-red-400",
  neutral: "bg-muted text-muted-foreground",
};

export function toneBadgeClass(tone: WidgetTone | undefined): string {
  return TONE_BADGE[tone ?? "neutral"];
}

// Cor da barra de ocupação pela faixa de carga — verde cheio, azul alto,
// âmbar médio, cinza baixo. Dá leitura rápida de quais caminhões estão
// otimizados.
function loadColor(percent: number): string {
  if (percent >= 90) return "#10b981";
  if (percent >= 70) return "#3b82f6";
  if (percent >= 50) return "#f59e0b";
  return "#94a3b8";
}

export function FleetWidget({
  value,
}: {
  value: Extract<WidgetValue, { kind: "FLEET" }>;
}) {
  if (value.trucks.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        Nenhum caminhão.
      </p>
    );
  }
  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto pr-1 text-xs">
      {value.trucks.map((truck) => {
        const percent = Math.min(100, Math.max(0, truck.loadPercent));
        return (
          <div
            key={truck.id}
            className="flex items-center gap-2 border-border/60 border-b py-1 last:border-0"
          >
            <span className="w-16 shrink-0 font-mono font-medium text-[11px]">
              {truck.plate}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{truck.driver}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {truck.route}
              </p>
            </div>
            <div className="w-20 shrink-0">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percent}%`,
                    background: loadColor(percent),
                  }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {percent}%
              </span>
            </div>
            {truck.eta && (
              <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">
                {truck.eta}
              </span>
            )}
            {truck.status && (
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 font-medium text-[9px] uppercase tracking-wide",
                  toneBadgeClass(truck.statusTone),
                )}
              >
                {truck.status}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
