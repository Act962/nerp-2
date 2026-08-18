"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { CalendarAgendaList } from "@/features/calendario/components/calendar-agenda-list";
import { CalendarDayView } from "@/features/calendario/components/calendar-day-view";
import { CalendarEventSheet } from "@/features/calendario/components/calendar-event-sheet";
import { CalendarMonthMobile } from "@/features/calendario/components/calendar-month-mobile";
import { CalendarNoteDialog } from "@/features/calendario/components/calendar-note-dialog";
import {
  useCalendarFilterOptions,
  useCalendarList,
} from "@/features/calendario/hooks/use-calendario";
import type {
  CalendarItem,
  CalendarNoteItem,
} from "@/features/calendario/lib/calendar-item";
import {
  monthGridDays,
  visibleRange,
} from "@/features/calendario/lib/calendar-range";
import { cn } from "@/lib/utils";
import dayjs, { type Dayjs } from "dayjs";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";

type MobileView = "month" | "day" | "agenda";

/**
 * Calendário dentro do App Promotor, no formato do app de calendário do
 * celular: mês com números grandes, hoje em círculo cheio e barra flutuante
 * com "Hoje" e o botão de criar.
 *
 * A casca é própria (mobile); o índice de dias e o catálogo de datas vêm de
 * `features/calendario/lib`, e as visões Dia e Agenda são as mesmas do Trade.
 */
export function PromoterCalendarSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [cursor, setCursor] = useState<Dayjs>(dayjs());
  const [view, setView] = useState<MobileView>("month");
  const [openedEventId, setOpenedEventId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<CalendarNoteItem | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteTimed, setNoteTimed] = useState(false);
  const [noteDay, setNoteDay] = useState<Dayjs>(dayjs());

  // Sempre o mês inteiro: mesmo na visão Dia, ter o mês em mãos evita uma nova
  // consulta a cada toque na seta — o promotor está em 4G dentro da loja.
  const days = useMemo(() => monthGridDays(cursor), [cursor]);
  const range = useMemo(() => visibleRange(days), [days]);

  const { ufs } = useCalendarFilterOptions();
  const { events, notes, isLoading } = useCalendarList(range);

  const items = useMemo<CalendarItem[]>(
    () => [
      ...events.map((event) => ({ ...event, kind: "event" as const })),
      ...notes.map((note) => ({ ...note, kind: "note" as const })),
    ],
    [events, notes],
  );

  const openItem = (item: CalendarItem) => {
    if (item.kind === "note") {
      setEditingNote(item);
      setNoteOpen(true);
      return;
    }
    setOpenedEventId(item.id);
  };

  const openNewNote = (day: Dayjs, timed: boolean) => {
    setEditingNote(null);
    setNoteDay(day);
    setNoteTimed(timed);
    setNoteOpen(true);
  };

  const step = view === "month" ? "month" : "day";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[95dvh] flex-col gap-0 p-0">
        <SheetHeader className="gap-1 px-4 pb-2 pt-4">
          <SheetTitle className="sr-only">Calendário</SheetTitle>
          <SheetDescription className="sr-only">
            Feriados, datas comemorativas e as ações dos seus clientes e
            indústrias.
          </SheetDescription>

          <div className="flex items-center justify-between">
            {/* Ano com as setas ao lado, como no calendário do celular. */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label="Anterior"
                onClick={() => setCursor(cursor.subtract(1, step))}
              >
                <ChevronLeft className="size-5" />
              </Button>
              <span className="text-lg font-semibold tabular-nums">
                {cursor.year()}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label="Próximo"
                onClick={() => setCursor(cursor.add(1, step))}
              >
                <ChevronRight className="size-5" />
              </Button>
            </div>

            <div className="flex items-center gap-1 rounded-full border p-0.5">
              {(
                [
                  { id: "month", label: "Mês" },
                  { id: "day", label: "Dia" },
                  { id: "agenda", label: "Agenda" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setView(option.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    view === option.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          ) : view === "month" ? (
            <CalendarMonthMobile
              cursor={cursor}
              items={items}
              ufs={ufs}
              onSelectDay={(day) => openNewNote(day, true)}
              onOpenItem={openItem}
            />
          ) : view === "day" ? (
            <CalendarDayView
              cursor={cursor}
              items={items}
              ufs={ufs}
              onOpenItem={openItem}
            />
          ) : (
            <CalendarAgendaList
              days={days}
              items={items}
              ufs={ufs}
              onOpenItem={openItem}
            />
          )}
        </div>

        {/* Barra flutuante: "Hoje" à esquerda e criar à direita, no alcance do
          polegar — no celular o topo da tela é a parte mais difícil de tocar. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-4">
          <Button
            type="button"
            variant="outline"
            className="pointer-events-auto h-11 rounded-full px-5 shadow-lg"
            onClick={() => setCursor(dayjs())}
          >
            Hoje
          </Button>

          <Button
            type="button"
            className="pointer-events-auto h-12 gap-1.5 rounded-full px-5 shadow-lg"
            onClick={() =>
              openNewNote(view === "month" ? dayjs() : cursor, true)
            }
          >
            <Plus className="size-5" /> Anotação
          </Button>
        </div>

        {/* Sem `onEdit`: o promotor lê o evento e marca o próprio checklist,
          mas não edita o que a coordenação publicou. */}
        <CalendarEventSheet
          eventId={openedEventId}
          open={openedEventId !== null}
          onOpenChange={(isOpen) => !isOpen && setOpenedEventId(null)}
        />

        <CalendarNoteDialog
          note={editingNote}
          defaultDay={noteDay}
          defaultTimed={noteTimed}
          open={noteOpen}
          onOpenChange={(isOpen) => {
            setNoteOpen(isOpen);
            if (!isOpen) setEditingNote(null);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
