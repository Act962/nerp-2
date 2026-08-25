"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tab } from "../utils/categorize";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  counts: Record<Tab, number>;
}

const items: { value: Tab; label: string }[] = [
  { value: "prontos", label: "Prontos" },
  { value: "atrasados", label: "Atrasados" },
  { value: "emPreparo", label: "Em preparo" },
  { value: "todos", label: "Todos" },
  { value: "concluidos", label: "Concluídos" },
];

export function WaiterTabs({ active, onChange, counts }: Props) {
  return (
    <div
      role="tablist"
      className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1 scrollbar-none"
    >
      {items.map((item) => {
        const isActive = item.value === active;
        const count = counts[item.value];
        const isReadyHighlight = item.value === "prontos" && count > 0;
        const isOverdueAlert = item.value === "atrasados" && count > 0;
        const isOverdueIdle = item.value === "atrasados" && count === 0;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.value)}
            className={cn(
              "shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition",
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground hover:bg-accent",
              isReadyHighlight &&
                "animate-pulse !border-emerald-500 !bg-emerald-500 !text-white shadow-[0_0_0_4px_rgba(16,185,129,0.25)]",
              isOverdueAlert &&
                "animate-pulse !border-red-600 !bg-red-600 !text-white shadow-[0_0_0_4px_rgba(220,38,38,0.25)]",
              isOverdueIdle && !isActive && "border-red-500 text-red-600",
            )}
          >
            <span>{item.label}</span>
            <Badge
              className={cn(
                "h-5 min-w-5 px-1.5 text-xs",
                isReadyHighlight && "bg-white text-emerald-600",
                isOverdueAlert && "bg-white text-red-600",
                !isActive &&
                  !isReadyHighlight &&
                  !isOverdueAlert &&
                  "bg-muted text-foreground",
              )}
              variant={isActive ? "secondary" : "outline"}
            >
              {count}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
