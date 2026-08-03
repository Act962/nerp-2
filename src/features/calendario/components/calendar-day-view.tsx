"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Dayjs } from "dayjs";
import { Lock, MapPin, Plus } from "lucide-react";
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
 * Visão Dia — é aqui que o promotor trabalha.
 *
 * Cada evento aparece com o progresso do próprio checklist, que é o que ele
 * marca em campo; o item em si abre no painel lateral.
 */
export function CalendarDayView({
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
  const key = dayKey(cursor);
  const dayItems = useMemo(
    () => sortItems(buildItemsByDay(items).get(key) ?? []),
    [items, key],
  );
  const dates = useMemo(
    () => buildCommemorativeIndex([cursor], ufs).get(key) ?? [],
    [cursor, ufs, key],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold capitalize">
          {longDateLabel(cursor)}
        </h3>
        {onCreateForDate && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => onCreateForDate(cursor)}
          >
            <Plus className="size-4" /> Evento
          </Button>
        )}
      </div>

      {dates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dates.map((date) => (
            <div key={date.id} className="max-w-[18rem]">
              <CalendarCommemorativeBadge date={date} />
            </div>
          ))}
        </div>
      )}

      {dayItems.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nada agendado neste dia.
        </p>
      ) : (
        <ul className="space-y-2">
          {dayItems.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <button
                type="button"
                onClick={() => onOpenItem(item)}
                className="flex w-full items-start gap-3 rounded-lg border p-3 text-left hover:bg-accent"
              >
                <span
                  className="w-1 shrink-0 self-stretch rounded-full"
                  style={{ backgroundColor: itemColor(item) }}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  {/* Sem `truncate`: o título é a informação principal do
                    item e cortá-lo em "Passar no Supermercado Coelho pa…"
                    obriga a abrir o item para ler o que já estava escrito. */}
                  <p className="flex items-start gap-1.5 font-medium">
                    {item.kind === "note" && (
                      <Lock className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="break-words">{item.title}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {itemTimeLabel(item)}
                    {item.kind === "event" && item.location && (
                      <>
                        {" · "}
                        <MapPin className="inline size-3" /> {item.location}
                      </>
                    )}
                  </p>
                  {item.kind === "note" && item.tasks.length > 0 && (
                    <p className="text-xs">
                      <span className="font-medium tabular-nums">
                        {item.tasks.filter((task) => task.isDone).length}/
                        {item.tasks.length}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        itens do checklist
                      </span>
                    </p>
                  )}
                  {item.kind === "event" && item.checklistCount > 0 && (
                    <p className="text-xs">
                      <span className="tabular-nums font-medium">
                        {item.myDoneCount}/{item.checklistCount}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        atividades concluídas por você
                      </span>
                    </p>
                  )}
                </div>
                {item.kind === "event" && (
                  <Badge className={STATUS_BADGE[item.status]}>
                    {STATUS_LABEL[item.status]}
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
