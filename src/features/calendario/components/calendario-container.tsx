"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import dayjs, { type Dayjs } from "dayjs";
import { NotebookPen, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useCalendarFilterOptions,
  useCalendarList,
  useMoveCalendarEvent,
} from "../hooks/use-calendario";
import type { CalendarItem, CalendarNoteItem } from "../lib/calendar-item";
import { monthGridDays, visibleRange, weekDays } from "../lib/calendar-range";
import { CalendarAgendaList } from "./calendar-agenda-list";
import { CalendarDayView } from "./calendar-day-view";
import { CalendarEventDialog } from "./calendar-event-dialog";
import { CalendarEventSheet } from "./calendar-event-sheet";
import { CalendarMonthGrid } from "./calendar-month-grid";
import { CalendarNoteDialog } from "./calendar-note-dialog";
import { CalendarToolbar, type CalendarView } from "./calendar-toolbar";
import { CalendarWeekView } from "./calendar-week-view";

/**
 * Casca do calendário. Usada pela página do Trade; o promotor tem a sua própria
 * casca (um Sheet), mas as VIEWS abaixo são as mesmas nos dois.
 */
export function CalendarioContainer() {
  const [cursor, setCursor] = useState<Dayjs>(dayjs());
  const [view, setView] = useState<CalendarView>("month");
  const [search, setSearch] = useState("");

  const [openedEventId, setOpenedEventId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<CalendarNoteItem | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteTimed, setNoteTimed] = useState(false);
  const [formDay, setFormDay] = useState<Dayjs>(dayjs());

  // Os dias visíveis definem a janela consultada — agenda usa o mês inteiro.
  const days = useMemo(() => {
    if (view === "week") return weekDays(cursor);
    if (view === "day") return [cursor];
    return monthGridDays(cursor);
  }, [view, cursor]);

  const range = useMemo(() => visibleRange(days), [days]);
  const { ufs } = useCalendarFilterOptions();
  const { events, notes, canManage, isLoading } = useCalendarList(range, {
    search: search.trim() || undefined,
  });
  const move = useMoveCalendarEvent();

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
      setNoteDialogOpen(true);
      return;
    }
    setOpenedEventId(item.id);
  };

  const createEventForDate = (day: Dayjs) => {
    setFormDay(day);
    setEditingEventId(null);
    setEventDialogOpen(true);
  };

  /**
   * Tocar num dia da grade cria ANOTAÇÃO, não evento.
   *
   * É a ação rápida e pessoal ("passar no Coelho às 14h") e é a única que todo
   * mundo pode fazer — evento é publicação para a equipe e sai pelo botão
   * "Novo evento", que diz o que faz.
   */
  const createNoteForDate = (day: Dayjs) => {
    setFormDay(day);
    setEditingNote(null);
    setNoteTimed(true);
    setNoteDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <CalendarToolbar
        cursor={cursor}
        view={view}
        onCursorChange={setCursor}
        onViewChange={setView}
        actions={
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar evento…"
              className="h-9 w-40"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setFormDay(cursor);
                setEditingNote(null);
                setNoteTimed(false);
                setNoteDialogOpen(true);
              }}
            >
              <NotebookPen className="size-4" />
              <span className="hidden sm:inline">Anotação</span>
            </Button>
            {canManage && (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => createEventForDate(cursor)}
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Novo evento</span>
              </Button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : view === "month" ? (
        <CalendarMonthGrid
          cursor={cursor}
          items={items}
          ufs={ufs}
          draggable={canManage}
          onOpenItem={openItem}
          onCreateForDate={createNoteForDate}
          onMoveItem={(id, startsAt) => move.mutate({ id, startsAt })}
        />
      ) : view === "week" ? (
        <CalendarWeekView
          cursor={cursor}
          items={items}
          ufs={ufs}
          onOpenItem={openItem}
          onCreateForDate={canManage ? createEventForDate : undefined}
        />
      ) : view === "day" ? (
        <CalendarDayView
          cursor={cursor}
          items={items}
          ufs={ufs}
          onOpenItem={openItem}
          onCreateForDate={canManage ? createEventForDate : undefined}
        />
      ) : (
        <CalendarAgendaList
          days={days}
          items={items}
          ufs={ufs}
          onOpenItem={openItem}
        />
      )}

      <CalendarEventSheet
        eventId={openedEventId}
        open={openedEventId !== null}
        onOpenChange={(open) => !open && setOpenedEventId(null)}
        onEdit={
          canManage
            ? (id) => {
                setOpenedEventId(null);
                setEditingEventId(id);
                setEventDialogOpen(true);
              }
            : undefined
        }
      />

      {canManage && (
        <CalendarEventDialog
          eventId={editingEventId}
          defaultDay={formDay}
          open={eventDialogOpen}
          onOpenChange={(open) => {
            setEventDialogOpen(open);
            if (!open) setEditingEventId(null);
          }}
        />
      )}

      <CalendarNoteDialog
        note={editingNote}
        defaultDay={formDay}
        defaultTimed={noteTimed}
        open={noteDialogOpen}
        onOpenChange={(open) => {
          setNoteDialogOpen(open);
          if (!open) setEditingNote(null);
        }}
      />
    </div>
  );
}
