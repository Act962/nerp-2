import dayjs, { type Dayjs } from "dayjs";
import { dayKey } from "./calendar-range";

export type EventType =
  | "ACAO_PDV"
  | "CAMPANHA"
  | "VISITA"
  | "TREINAMENTO"
  | "REUNIAO"
  | "LANCAMENTO"
  | "OUTRO";

export type EventStatus =
  | "PLANEJADO"
  | "EM_ANDAMENTO"
  | "CONCLUIDO"
  | "CANCELADO";

export interface CalendarEventItem {
  kind: "event";
  id: string;
  title: string;
  type: EventType;
  status: EventStatus;
  visibility: "ORG" | "LINKED";
  color: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  location: string | null;
  storeCount: number;
  supplierCount: number;
  checklistCount: number;
  myDoneCount: number;
}

export interface CalendarNoteTaskItem {
  id: string;
  title: string;
  isDone: boolean;
}

export interface CalendarNoteItem {
  kind: "note";
  id: string;
  title: string;
  content: string | null;
  color: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  tasks: CalendarNoteTaskItem[];
}

/** União discriminada: nota e evento nunca se confundem na renderização. */
export type CalendarItem = CalendarEventItem | CalendarNoteItem;

/**
 * Um item ocupa TODOS os dias entre início e fim.
 *
 * Teto de 90 dias: uma campanha anual viraria card em 365 células e, com a
 * altura de linha variável, transformaria o mês numa parede de cards.
 */
const MAX_DAYS = 90;

/** Acima disto o item vira faixa fina e sai do cálculo de altura da linha. */
export const LONG_ITEM_DAYS = 14;

export function itemDayCount(item: CalendarItem): number {
  const start = dayjs(item.startsAt).startOf("day");
  const end = dayjs(item.endsAt).startOf("day");
  return Math.max(1, end.diff(start, "day") + 1);
}

export function isLongItem(item: CalendarItem): boolean {
  return itemDayCount(item) > LONG_ITEM_DAYS;
}

/** Índice "YYYY-MM-DD" → itens daquele dia. */
export function buildItemsByDay(
  items: CalendarItem[],
): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();

  for (const item of items) {
    const start = dayjs(item.startsAt).startOf("day");
    const end = dayjs(item.endsAt).startOf("day");

    let cursor = start;
    let guard = 0;
    while (!cursor.isAfter(end) && guard < MAX_DAYS) {
      const key = dayKey(cursor);
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
      cursor = cursor.add(1, "day");
      guard++;
    }
  }

  return map;
}

/** Ordena por horário — dia inteiro primeiro, depois por hora de início. */
export function sortItems(items: CalendarItem[]): CalendarItem[] {
  return [...items].sort((a, b) => {
    if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
    return a.startsAt.localeCompare(b.startsAt);
  });
}

export function itemTimeLabel(item: CalendarItem): string {
  return item.isAllDay ? "Dia todo" : dayjs(item.startsAt).format("HH:mm");
}

export function isSameDay(item: CalendarItem, date: Dayjs): boolean {
  return dayKey(dayjs(item.startsAt)) === dayKey(date);
}
