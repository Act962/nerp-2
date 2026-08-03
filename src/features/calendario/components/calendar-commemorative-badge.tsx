"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Lightbulb } from "lucide-react";
import { useCalendarFilterOptions } from "../hooks/use-calendario";
import { KIND_STYLE } from "../lib/calendar-colors";
import type { CommemorativeDate } from "../lib/commemorative";
import { KIND_LABEL } from "../lib/commemorative";
import { buildCommemorativeIdeas } from "../lib/commemorative-ideas";

/**
 * Pílula da data comemorativa, com o "porquê" no popover.
 *
 * O impacto e as dicas são o que transformam a data em ação — sem isso o
 * promotor lê "Dia da Pizza" e não sabe o que fazer com a informação. As ideias
 * do fim cruzam a data com as marcas e lojas que ELE favoritou.
 */
export function CalendarCommemorativeBadge({
  date,
  compact,
  className,
}: {
  date: CommemorativeDate;
  compact?: boolean;
  className?: string;
}) {
  const { stores, suppliers } = useCalendarFilterOptions();

  const ideas = buildCommemorativeIdeas(date, {
    suppliers: suppliers
      .filter((supplier) => supplier.isFavorite)
      .map((supplier) => supplier.name),
    stores: stores
      .filter((store) => store.isFavorite)
      .map((store) => store.name),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            // `truncate` por padrão: o rótulo já é curto de propósito e o
            // título completo está no popover. Quem tem espaço (a grade do
            // celular) sobrescreve com `whitespace-normal`.
            "block w-full truncate rounded px-1 text-left font-medium leading-tight",
            compact ? "text-[9px]" : "text-[10px]",
            KIND_STYLE[date.kind],
            className,
          )}
        >
          {date.label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[70vh] w-80 space-y-2 overflow-y-auto text-sm"
      >
        <div>
          <p className="font-semibold leading-tight">{date.title}</p>
          <p className="text-xs text-muted-foreground">
            {KIND_LABEL[date.kind]}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">{date.description}</p>

        <div className={cn("rounded-md p-2 text-xs", KIND_STYLE[date.kind])}>
          <span className="font-medium">Impacto: </span>
          {date.impact}
        </div>

        {date.tips.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium">Dicas de ação</p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {date.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        {ideas.length > 0 && (
          <div className="space-y-1 border-t pt-2">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <Lightbulb className="size-3.5 text-amber-500" />
              Ideias para as suas marcas
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {ideas.map((idea) => (
                <li key={idea.id} className="rounded bg-muted px-2 py-1">
                  {idea.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
