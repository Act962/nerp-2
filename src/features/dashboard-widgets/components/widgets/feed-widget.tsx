"use client";

import { AlertTriangle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WidgetTone, WidgetValue } from "../../lib/widget-value";
import { toneBadgeClass } from "./fleet-widget";

const TONE_ICON: Record<WidgetTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertTriangle,
  neutral: Info,
};

// Feed de alertas da IA operacional: cada item com ícone por tom, título em
// destaque, subtítulo discreto e hora à direita. Rola dentro do card.
export function FeedWidget({
  value,
}: {
  value: Extract<WidgetValue, { kind: "FEED" }>;
}) {
  if (value.items.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        Nenhum alerta.
      </p>
    );
  }
  return (
    <div className="flex h-full flex-col gap-1.5 overflow-y-auto pr-1">
      {value.items.map((item) => {
        const Icon = TONE_ICON[item.tone];
        return (
          <div key={item.id} className="flex items-start gap-2">
            <span
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                toneBadgeClass(item.tone),
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-xs leading-snug">{item.title}</p>
              {item.subtitle && (
                <p className="truncate text-[10px] text-muted-foreground">
                  {item.subtitle}
                </p>
              )}
            </div>
            {item.time && (
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                {item.time}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
