"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo } from "react";
import { WEEKDAYS, dayKey, monthGridDays } from "../lib/calendar-range";
import {
  type CalendarItem,
  buildItemsByDay,
  isLongItem,
  sortItems,
} from "../lib/calendar-item";
import { buildCommemorativeIndex } from "../lib/commemorative";
import { CalendarCommemorativeBadge } from "./calendar-commemorative-badge";
import {
  CalendarEventCard,
  TITLE_LINE_HEIGHT,
  itemColor,
  titleLines,
} from "./calendar-event-card";

// Geometria da célula, em px. Cada linha do mês é dimensionada pelo dia mais
// cheio dela — grade uniforme ou desperdiça espaço ou corta card.
const CARD_HEIGHT = 34;
const CARD_GAP = 3;
const CELL_PADDING = 4;
const PLUS_MORE_HEIGHT = 18;
const BADGE_HEIGHT = 14;
const DAY_NUMBER_HEIGHT = 22;
const EMPTY_ROW_HEIGHT = 76;
/** Teto de pílulas de data comemorativa por dia; o resto vai para o popover. */
const MAX_BADGES = 2;

function DayCell({
  day,
  cursor,
  items,
  commemoratives,
  maxVisible,
  compact,
  draggable,
  onOpenItem,
  onCreateForDate,
}: {
  day: Dayjs;
  cursor: Dayjs;
  items: CalendarItem[];
  commemoratives: ReturnType<typeof buildCommemorativeIndex>;
  maxVisible: number;
  compact?: boolean;
  draggable?: boolean;
  onOpenItem: (item: CalendarItem) => void;
  onCreateForDate?: (day: Dayjs) => void;
}) {
  const key = dayKey(day);
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${key}`,
    disabled: !draggable,
  });

  const isOutside = !day.isSame(cursor, "month");
  const isToday = day.isSame(dayjs(), "day");
  const dates = commemoratives.get(key) ?? [];
  const visibleBadges = dates.slice(0, MAX_BADGES);
  const hiddenBadges = dates.slice(MAX_BADGES);
  const visibleItems = items.slice(0, maxVisible);
  const overflow = items.length - visibleItems.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex flex-col gap-0.5 overflow-hidden rounded-lg border",
        onCreateForDate && "cursor-pointer",
        isToday
          ? "bg-primary/10 ring-1 ring-primary/40"
          : isOutside
            ? "bg-muted/40"
            : "bg-card",
        isOver && "ring-2 ring-primary",
      )}
      style={{ padding: `${CELL_PADDING}px` }}
    >
      {/* Botão de fundo em vez de onClick na div: clicar no vazio da célula
        cria o evento, mas continua sendo um elemento focável e alcançável por
        teclado — a div com handler não é. */}
      {onCreateForDate && (
        <button
          type="button"
          aria-label={`Novo evento em ${day.format("DD/MM/YYYY")}`}
          onClick={() => onCreateForDate(day)}
          className="absolute inset-0 cursor-pointer"
        />
      )}

      <div className="relative flex items-center justify-between">
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-full text-[11px] font-medium",
            isToday && "bg-primary text-primary-foreground",
            isOutside && !isToday && "text-muted-foreground",
          )}
        >
          {day.date()}
        </span>
      </div>

      <div className="relative flex flex-col gap-0.5">
        {visibleBadges.map((date) => (
          <CalendarCommemorativeBadge
            key={date.id}
            date={date}
            compact={compact}
          />
        ))}
        {hiddenBadges.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(event) => event.stopPropagation()}
                className="w-full rounded bg-muted px-1 text-left text-[9px] text-muted-foreground"
              >
                +{hiddenBadges.length} data(s)
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 space-y-1">
              {hiddenBadges.map((date) => (
                <CalendarCommemorativeBadge key={date.id} date={date} />
              ))}
            </PopoverContent>
          </Popover>
        )}

        {visibleItems.map((item) => (
          <DraggableCard
            key={`${item.kind}-${item.id}`}
            item={item}
            draggable={draggable && item.kind === "event"}
            compact={compact}
            onOpen={onOpenItem}
          />
        ))}

        {overflow > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(event) => event.stopPropagation()}
                className="w-full rounded px-1 text-left text-[10px] font-medium text-muted-foreground hover:bg-accent"
              >
                +{overflow} mais
              </button>
            </PopoverTrigger>
            {/* Botões simples aqui de propósito: o popover renderiza em portal,
            fora do DndContext, e um card arrastável não encontraria o alvo. */}
            <PopoverContent align="start" className="w-64 space-y-1">
              {items.slice(maxVisible).map((item) => (
                <button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  onClick={() => onOpenItem(item)}
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-accent"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: itemColor(item) }}
                  />
                  <span className="truncate">{item.title}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  item,
  draggable,
  compact,
  onOpen,
}: {
  item: CalendarItem;
  draggable?: boolean;
  compact?: boolean;
  onOpen: (item: CalendarItem) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `item-${item.kind}-${item.id}`,
    data: { item },
    disabled: !draggable,
  });

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      className={cn("touch-none", isDragging && "opacity-40")}
    >
      <CalendarEventCard
        item={item}
        onOpen={onOpen}
        compact={compact}
        height={CARD_HEIGHT}
      />
    </div>
  );
}

/**
 * Grade do mês. UM arquivo só para admin e promotor — o cálculo de altura é a
 * parte difícil e duas cópias divergem em duas semanas.
 */
export function CalendarMonthGrid({
  cursor,
  items,
  ufs,
  maxVisible = 4,
  compact,
  draggable,
  onOpenItem,
  onCreateForDate,
  onMoveItem,
}: {
  cursor: Dayjs;
  items: CalendarItem[];
  ufs: string[];
  maxVisible?: number;
  compact?: boolean;
  draggable?: boolean;
  onOpenItem: (item: CalendarItem) => void;
  onCreateForDate?: (day: Dayjs) => void;
  onMoveItem?: (itemId: string, startsAt: string) => void;
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

  // Altura de cada linha = a do dia mais ALTO dela, somando o que ele de fato
  // renderiza. Mede altura, não contagem: desde que o título quebra em várias
  // linhas, dois cards podem ocupar mais espaço que quatro.
  const rowHeights = useMemo(() => {
    const heights: number[] = [];
    for (let index = 0; index < days.length; index += 7) {
      const week = days.slice(index, index + 7);
      let tallest = 0;

      for (const day of week) {
        const key = dayKey(day);
        // Itens longos viram faixa e não disputam altura da linha.
        const dayItems = (itemsByDay.get(key) ?? []).filter(
          (item) => !isLongItem(item),
        );
        const visible = dayItems.slice(0, maxVisible);
        const badges = Math.min(
          commemoratives.get(key)?.length ?? 0,
          MAX_BADGES + 1,
        );

        const cards = visible.reduce(
          (total, item) =>
            total +
            CARD_HEIGHT +
            (titleLines(item) - 1) * TITLE_LINE_HEIGHT +
            CARD_GAP,
          0,
        );

        const height =
          CELL_PADDING * 2 +
          DAY_NUMBER_HEIGHT +
          badges * (BADGE_HEIGHT + CARD_GAP) +
          cards +
          (dayItems.length > maxVisible ? PLUS_MORE_HEIGHT : 0);

        tallest = Math.max(tallest, height);
      }

      heights.push(Math.max(EMPTY_ROW_HEIGHT, tallest));
    }
    return heights;
  }, [days, itemsByDay, commemoratives, maxVisible]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const dropId = event.over?.id;
    if (typeof dropId !== "string" || !dropId.startsWith("day-")) return;

    const item = (event.active.data.current as { item?: CalendarItem } | null)
      ?.item;
    if (!item || item.kind !== "event") return;

    // Preserva a hora original — mover de dia não é remarcar o horário.
    const original = dayjs(item.startsAt);
    const target = dayjs(dropId.slice(4))
      .hour(original.hour())
      .minute(original.minute())
      .second(0);

    if (target.isSame(original, "day")) return;
    onMoveItem?.(item.id, target.toISOString());
  };

  const grid = (
    <>
      <div className="grid grid-cols-7 gap-1 pb-1">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="text-center text-[11px] font-medium text-muted-foreground"
          >
            {weekday}
          </div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 gap-1"
        style={{
          gridTemplateRows: rowHeights.map((h) => `${h}px`).join(" "),
        }}
      >
        {days.map((day) => (
          <DayCell
            key={dayKey(day)}
            day={day}
            cursor={cursor}
            items={itemsByDay.get(dayKey(day)) ?? []}
            commemoratives={commemoratives}
            maxVisible={maxVisible}
            compact={compact}
            draggable={draggable}
            onOpenItem={onOpenItem}
            onCreateForDate={onCreateForDate}
          />
        ))}
      </div>
    </>
  );

  if (!draggable) return <div className="space-y-1">{grid}</div>;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-1">{grid}</div>
    </DndContext>
  );
}
