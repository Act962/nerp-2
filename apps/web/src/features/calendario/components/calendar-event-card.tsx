"use client";

import { cn } from "@/lib/utils";
import { Check, Lock, Users } from "lucide-react";
import { NOTE_COLOR, TYPE_COLOR } from "../lib/calendar-colors";
import type { CalendarItem } from "../lib/calendar-item";
import { itemTimeLabel } from "../lib/calendar-item";

/**
 * Quantas linhas o título vai ocupar na célula do mês.
 *
 * Estimativa por contagem de caracteres — não dá para medir texto antes de
 * renderizar, e o `line-clamp` da mesma constante garante que um erro para
 * menos não vaze da célula.
 */
const CHARS_PER_LINE = 15;
export const MAX_TITLE_LINES = 3;
export const TITLE_LINE_HEIGHT = 11;

export function titleLines(item: CalendarItem): number {
  return Math.min(
    MAX_TITLE_LINES,
    Math.max(1, Math.ceil(item.title.length / CHARS_PER_LINE)),
  );
}

export function itemColor(item: CalendarItem): string {
  if (item.color) return item.color;
  return item.kind === "note" ? NOTE_COLOR : TYPE_COLOR[item.type];
}

/** Card do item dentro de uma célula do mês/semana. */
export function CalendarEventCard({
  item,
  onOpen,
  compact,
  height,
}: {
  item: CalendarItem;
  onOpen: (item: CalendarItem) => void;
  compact?: boolean;
  height?: number;
}) {
  const color = itemColor(item);
  const done =
    item.kind === "event" &&
    item.checklistCount > 0 &&
    item.myDoneCount >= item.checklistCount;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(item);
      }}
      style={{
        background: `linear-gradient(135deg, ${color} 0%, ${color}cc 60%, ${color}99 100%)`,
        ...(height ? { minHeight: `${height}px` } : {}),
      }}
      className={cn(
        "flex w-full flex-col justify-between overflow-hidden rounded px-1.5 py-1 text-left text-white shadow-sm transition-opacity hover:opacity-90",
        compact ? "text-[9px]" : "text-[10px]",
      )}
    >
      {/* Título em várias linhas, não cortado: numa célula estreita quase todo
        título vira "Passar no Sup…", que não diz nada. O teto de linhas casa
        com o cálculo de altura da linha do mês (`titleLines`). */}
      <span className="flex items-start gap-1 font-semibold leading-tight">
        {item.kind === "note" && <Lock className="mt-px size-2.5 shrink-0" />}
        {done && <Check className="mt-px size-2.5 shrink-0" />}
        <span className="line-clamp-3 break-words">{item.title}</span>
      </span>
      <span className="flex items-center gap-1 truncate opacity-80">
        {itemTimeLabel(item)}
        {item.kind === "event" && item.storeCount > 0 && (
          <>
            <Users className="size-2.5 shrink-0" />
            {item.storeCount}
          </>
        )}
      </span>
    </button>
  );
}
