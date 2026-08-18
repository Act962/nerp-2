"use client";

import { Badge } from "@/components/ui/badge";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { Lock, MapPin } from "lucide-react";
import { useMemo } from "react";
import { STATUS_BADGE, STATUS_LABEL } from "../lib/calendar-colors";
import {
  type CalendarItem,
  buildItemsByDay,
  itemTimeLabel,
  sortItems,
} from "../lib/calendar-item";
import { dayKey, longDateLabel } from "../lib/calendar-range";
import { buildCommemorativeIndex } from "../lib/commemorative";
import { CalendarCommemorativeBadge } from "./calendar-commemorative-badge";
import { itemColor } from "./calendar-event-card";

/**
 * Lista cronológica. É a visão padrão no celular: com o polegar, rolar uma
 * lista é mais rápido do que caçar um card de 34px numa grade de 42 células.
 */
export function CalendarAgendaList({
  days,
  items,
  ufs,
  onOpenItem,
}: {
  days: Dayjs[];
  items: CalendarItem[];
  ufs: string[];
  onOpenItem: (item: CalendarItem) => void;
}) {
  const itemsByDay = useMemo(() => buildItemsByDay(items), [items]);
  const commemoratives = useMemo(
    () => buildCommemorativeIndex(days, ufs),
    [days, ufs],
  );

  // Só dias com algo — uma agenda com 20 dias vazios não é uma agenda.
  const filled = days.filter(
    (day) =>
      (itemsByDay.get(dayKey(day))?.length ?? 0) > 0 ||
      (commemoratives.get(dayKey(day))?.length ?? 0) > 0,
  );

  if (filled.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nada agendado neste período.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {filled.map((day) => {
        const key = dayKey(day);
        const dayItems = sortItems(itemsByDay.get(key) ?? []);
        const dates = commemoratives.get(key) ?? [];
        const isToday = day.isSame(dayjs(), "day");

        return (
          <section key={key} className="space-y-1.5">
            <h3 className="flex items-center gap-2 border-b pb-1 text-sm font-semibold capitalize">
              {longDateLabel(day)}
              {isToday && <Badge variant="secondary">Hoje</Badge>}
            </h3>

            {dates.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {dates.map((date) => (
                  <div key={date.id} className="max-w-[16rem]">
                    <CalendarCommemorativeBadge date={date} />
                  </div>
                ))}
              </div>
            )}

            {dayItems.map((item) => (
              <button
                key={`${item.kind}-${item.id}`}
                type="button"
                onClick={() => onOpenItem(item)}
                className="flex w-full items-start gap-2 rounded-md border p-2 text-left hover:bg-accent"
              >
                <span
                  className="mt-1 w-1 shrink-0 self-stretch rounded-full"
                  style={{ backgroundColor: itemColor(item) }}
                />
                <div className="min-w-0 flex-1">
                  {/* Título completo, sem corte — ver comentário no day-view. */}
                  <p className="flex items-start gap-1 text-sm font-medium">
                    {item.kind === "note" && (
                      <Lock className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    )}
                    <span className="break-words">{item.title}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {itemTimeLabel(item)}
                    {item.kind === "event" && item.location && (
                      <>
                        {" · "}
                        <MapPin className="inline size-3" /> {item.location}
                      </>
                    )}
                  </p>
                </div>
                {item.kind === "note" && item.tasks.length > 0 && (
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {item.tasks.filter((task) => task.isDone).length}/
                    {item.tasks.length}
                  </span>
                )}
                {item.kind === "event" && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge className={STATUS_BADGE[item.status]}>
                      {STATUS_LABEL[item.status]}
                    </Badge>
                    {item.checklistCount > 0 && (
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {item.myDoneCount}/{item.checklistCount}
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}
