"use client";

import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export function SalesGoalTeamHeader({
  teamName,
  subtitle,
  totalLabel,
  totalValue,
  top3Label,
  top3Value,
  accent,
  textOnDark = true,
}: {
  teamName: string;
  subtitle: string;
  totalLabel: string;
  totalValue: string;
  top3Label: string;
  top3Value: string;
  accent: string;
  textOnDark?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div
        className="size-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${accent}22` }}
      >
        <Trophy className="size-4" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-bold truncate",
            textOnDark && "text-white",
          )}
        >
          {teamName}
        </p>
        <p
          className={cn(
            "text-[11px]",
            textOnDark ? "text-white/60" : "text-muted-foreground",
          )}
        >
          {subtitle}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            "text-[11px] px-2.5 py-1 rounded-full bg-white/5 whitespace-nowrap",
            textOnDark ? "text-white/60" : "text-muted-foreground",
          )}
        >
          {totalLabel}:{" "}
          <strong className={cn(textOnDark ? "text-white" : "text-foreground")}>
            {totalValue}
          </strong>
        </span>
        <span
          className={cn(
            "text-[11px] px-2.5 py-1 rounded-full bg-white/5 whitespace-nowrap",
            textOnDark ? "text-white/60" : "text-muted-foreground",
          )}
        >
          {top3Label}: <strong className="text-emerald-400">{top3Value}</strong>
        </span>
      </div>
    </div>
  );
}
