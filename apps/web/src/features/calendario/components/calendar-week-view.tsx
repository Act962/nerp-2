"use client";

import { cn } from "@/lib/utils";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo } from "react";
import {
  type CalendarItem,
  buildItemsByDay,
  sortItems,
} from "../lib/calendar-item";
import { WEEKDAYS, dayKey, weekDays } from "../lib/calendar-range";
import { buildCommemorativeIndex } from "../lib/commemorative";
import { CalendarCommemorativeBadge } from "./calendar-commemorative-badge";
import { CalendarEventCard } from "./calendar-event-card";

/**
 * Semana em 7 colunas.
 *
 * Sem faixa de horas: no trade a maioria dos eventos é "dia todo" (campanha,
 * feriado, ação de PDV), então uma grade de 24 linhas seria 90% vazia. A hora
 * aparece no card, e quem precisa do detalhe hora a hora usa a visão Dia.
 */
export function CalendarWeekView({
  cursor,
  items,
  ufs,
  onOpenItem,
  onCreateForDate,
}: {
  cursor: Dayjs;
  items: CalendarItem[];
  ufs: string[];
  onOpenItem: (item: CalendarItem) => void;
  onCreateForDate?: (day: Dayjs) => void;
}) {
  const days = useMemo(() => weekDays(cursor), [cursor]);
  const itemsByDay = useMemo(() => buildItemsByDay(items), [items]);
  const commemoratives = useMemo(
    () => buildCommemorativeIndex(days, ufs),
    [days, ufs],
  );

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {days.map((day) => {
        const key = dayKey(day);
        const dayItems = sortItems(itemsByDay.get(key) ?? []);
        const dates = commemoratives.get(key) ?? [];
        const isToday = day.isSame(dayjs(), "day");

        return (
          <div
            key={key}
            className={cn(
              "flex min-h-40 flex-col gap-1 rounded-lg border p-2",
              isToday ? "bg-primary/10 ring-1 ring-primary/40" : "bg-card",
            )}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {WEEKDAYS[day.day()]}
              </span>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-sm font-semibold",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {day.date()}
              </span>
            </div>

            {dates.map((date) => (
              <CalendarCommemorativeBadge key={date.id} date={date} />
            ))}

            {dayItems.map((item) => (
              <CalendarEventCard
                key={`${item.kind}-${item.id}`}
                item={item}
                onOpen={onOpenItem}
              />
            ))}

            {onCreateForDate && (
              <button
                type="button"
                onClick={() => onCreateForDate(day)}
                className="mt-auto rounded border border-dashed py-1 text-[11px] text-muted-foreground hover:bg-accent"
              >
                + Evento
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
