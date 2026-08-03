"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useRef } from "react";
import {
  type CalendarItem,
  buildItemsByDay,
  sortItems,
} from "../lib/calendar-item";
import {
  dayKey,
  longDateLabel,
  monthGridDays,
  monthLabel,
} from "../lib/calendar-range";
import { buildCommemorativeIndex } from "../lib/commemorative";
import { CalendarCommemorativeBadge } from "./calendar-commemorative-badge";
import { itemColor } from "./calendar-event-card";

/** Letra única do dia da semana, como no calendário do iPhone. */
const WEEKDAY_INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Pílulas por dia. Acima disso vira "+N" — a célula é estreita no celular. */
const MAX_PILLS = 3;
/** Teto só das datas comemorativas dentro do MAX_PILLS. */
const MAX_DATE_PILLS = 2;

/**
 * Mês em estilo iOS: linhas separadas por fio, sem caixa em volta do dia,
 * números grandes e HOJE num círculo cheio.
 *
 * Separado do `calendar-month-grid` de propósito, apesar da regra de não
 * duplicar: aquele existe para o desktop (arrastar evento, altura de linha
 * variável, cards densos) e este para o polegar. O que era difícil e não podia
 * divergir — montar o índice do dia e o catálogo de datas — continua vindo de
 * `lib/`, então não há matemática duplicada aqui.
 */
export function CalendarMonthMobile({
  cursor,
  items,
  ufs,
  onSelectDay,
  onOpenItem,
}: {
  cursor: Dayjs;
  items: CalendarItem[];
  ufs: string[];
  onSelectDay: (day: Dayjs) => void;
  onOpenItem: (item: CalendarItem) => void;
}) {
  const days = useMemo(() => monthGridDays(cursor), [cursor]);
  const commemoratives = useMemo(
    () => buildCommemorativeIndex(days, ufs),
    [days, ufs],
  );
  const itemsByDay = useMemo(() => {
    const map = buildItemsByDay(items);
    for (const [key, list] of map) map.set(key, sortItems(list));
    return map;
  }, [items]);

  const todayRef = useRef<HTMLDivElement>(null);

  // Rola até hoje ao abrir o mês corrente — no iPhone o dia atual está sempre
  // à vista, e o promotor abre o calendário justamente para ver "e hoje?".
  useEffect(() => {
    if (!cursor.isSame(dayjs(), "month")) return;
    const timer = setTimeout(() => {
      todayRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
    return () => clearTimeout(timer);
  }, [cursor]);

  const weeks = useMemo(() => {
    const rows: Dayjs[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      rows.push(days.slice(index, index + 7));
    }
    return rows;
  }, [days]);

  return (
    <div className="space-y-2">
      <h2 className="text-3xl font-bold capitalize leading-none">
        {monthLabel(cursor).split(" de ")[0]}
      </h2>

      <div className="grid grid-cols-7 border-b pb-1.5">
        {WEEKDAY_INITIALS.map((initial, index) => (
          <span
            key={`${initial}-${index}`}
            className={cn(
              "text-center text-[11px] font-medium",
              index === 0 || index === 6
                ? "text-muted-foreground/60"
                : "text-muted-foreground",
            )}
          >
            {initial}
          </span>
        ))}
      </div>

      <div>
        {weeks.map((week) => (
          <div
            key={dayKey(week[0])}
            className="grid grid-cols-7 border-b last:border-0"
          >
            {week.map((day) => {
              const key = dayKey(day);
              const dayItems = itemsByDay.get(key) ?? [];
              const dates = commemoratives.get(key) ?? [];
              const isToday = day.isSame(dayjs(), "day");
              const isOutside = !day.isSame(cursor, "month");
              const isWeekend = day.day() === 0 || day.day() === 6;
              // Datas comemorativas primeiro e com componente próprio: tocar
              // nelas abre o popup com impacto e ideias, não a anotação.
              // Datas comemorativas têm teto próprio para nunca ocuparem
              // todos os espaços e esconderem as anotações do dia.
              const visibleDates = dates.slice(0, MAX_DATE_PILLS);
              const hiddenDates = dates.slice(visibleDates.length);
              const remaining = Math.max(0, MAX_PILLS - visibleDates.length);
              const visibleItems = dayItems.slice(0, remaining);
              const hiddenItems = dayItems.slice(visibleItems.length);
              const hidden = hiddenDates.length + hiddenItems.length;

              return (
                <div
                  key={key}
                  ref={isToday ? todayRef : undefined}
                  className="relative min-h-24 px-0.5 pb-1 pt-1.5"
                >
                  <button
                    type="button"
                    aria-label={`Nova anotação em ${day.format("DD/MM/YYYY")}`}
                    onClick={() => onSelectDay(day)}
                    className="absolute inset-0"
                  />

                  <div className="relative flex flex-col items-center gap-1">
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full text-base font-medium tabular-nums",
                        isToday && "bg-red-500 font-semibold text-white",
                        !isToday && isOutside && "text-muted-foreground/40",
                        !isToday &&
                          !isOutside &&
                          isWeekend &&
                          "text-muted-foreground",
                      )}
                    >
                      {day.date()}
                    </span>

                    <div className="w-full space-y-0.5">
                      {visibleDates.map((date) => (
                        <CalendarCommemorativeBadge
                          key={date.id}
                          date={date}
                          compact
                          className="whitespace-normal rounded px-1 py-px text-[8px]"
                        />
                      ))}
                      {/* Título inteiro, quebrando em quantas linhas precisar:
                        a célula tem `min-h`, então ela cresce junto. Cortar em
                        8px de fonte deixaria quase todo título ilegível. */}
                      {visibleItems.map((item) => (
                        <button
                          key={`${item.kind}-${item.id}`}
                          type="button"
                          onClick={() => onOpenItem(item)}
                          className="flex w-full items-start gap-0.5 rounded bg-muted px-1 py-px text-left text-[8px] font-medium leading-tight text-foreground"
                        >
                          <span
                            className="mt-1 size-1 shrink-0 rounded-full"
                            style={{ backgroundColor: itemColor(item) }}
                          />
                          <span className="break-words">{item.title}</span>
                        </button>
                      ))}
                      {hidden > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Ver mais ${hidden} de ${day.format("DD/MM")}`}
                              className="w-full rounded px-1 text-left text-[8px] font-medium text-muted-foreground hover:bg-accent"
                            >
                              +{hidden}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="center"
                            className="w-64 space-y-1"
                          >
                            <p className="px-1 text-xs font-medium capitalize">
                              {longDateLabel(day)}
                            </p>
                            {hiddenDates.map((date) => (
                              <CalendarCommemorativeBadge
                                key={date.id}
                                date={date}
                              />
                            ))}
                            {hiddenItems.map((item) => (
                              <button
                                key={`${item.kind}-${item.id}`}
                                type="button"
                                onClick={() => onOpenItem(item)}
                                className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-accent"
                              >
                                <span
                                  className="mt-1 size-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: itemColor(item) }}
                                />
                                <span className="break-words">
                                  {item.title}
                                </span>
                              </button>
                            ))}
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
