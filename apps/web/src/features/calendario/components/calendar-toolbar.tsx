"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { longDateLabel, monthLabel } from "../lib/calendar-range";

export type CalendarView = "month" | "week" | "day" | "agenda";

const VIEW_LABEL: Record<CalendarView, string> = {
  month: "Mês",
  week: "Semana",
  day: "Dia",
  agenda: "Agenda",
};

export function CalendarToolbar({
  cursor,
  view,
  views = ["month", "week", "day", "agenda"],
  onCursorChange,
  onViewChange,
  actions,
}: {
  cursor: Dayjs;
  view: CalendarView;
  views?: CalendarView[];
  onCursorChange: (cursor: Dayjs) => void;
  onViewChange: (view: CalendarView) => void;
  actions?: React.ReactNode;
}) {
  // O passo do navegador acompanha a visão: pular um mês na visão Dia deixaria
  // o promotor perdido.
  const step = view === "month" ? "month" : view === "week" ? "week" : "day";

  const title =
    view === "day" || view === "agenda"
      ? longDateLabel(cursor)
      : monthLabel(cursor);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Anterior"
          onClick={() => onCursorChange(cursor.subtract(1, step))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCursorChange(dayjs())}
        >
          Hoje
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Próximo"
          onClick={() => onCursorChange(cursor.add(1, step))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <p className="min-w-0 flex-1 truncate text-sm font-semibold capitalize">
        {title}
      </p>

      <div className="flex items-center gap-0.5 rounded-md border p-0.5">
        {views.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onViewChange(option)}
            className={cn(
              "rounded px-2 py-1 text-xs transition-colors",
              view === option
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {VIEW_LABEL[option]}
          </button>
        ))}
      </div>

      {actions}
    </div>
  );
}
