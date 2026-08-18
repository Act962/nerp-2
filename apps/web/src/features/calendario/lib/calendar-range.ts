import dayjs, { type Dayjs } from "dayjs";

/**
 * Datas do calendário — sempre no fuso do APARELHO.
 *
 * O servidor roda em UTC e o usuário está em UTC-3: se o dia local fosse
 * derivado lá, "hoje" começaria às 21h de ontem para ele. A API só trafega
 * instantes ISO; quem resolve o dia é este arquivo. Mesmo raciocínio já usado
 * em `src/features/promotor/components/date-range-filter.tsx`.
 */

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function dayKey(date: Dayjs): string {
  return date.format("YYYY-MM-DD");
}

/** As 42 células do mês, começando no domingo da primeira semana. */
export function monthGridDays(cursor: Dayjs): Dayjs[] {
  const startOfMonth = cursor.startOf("month");
  const first = startOfMonth.subtract(startOfMonth.day(), "day");
  return Array.from({ length: 42 }, (_, index) => first.add(index, "day"));
}

/** Os 7 dias da semana do cursor, domingo a sábado. */
export function weekDays(cursor: Dayjs): Dayjs[] {
  const first = cursor.subtract(cursor.day(), "day");
  return Array.from({ length: 7 }, (_, index) => first.add(index, "day"));
}

/** Janela a consultar no servidor, cobrindo todos os dias visíveis. */
export function visibleRange(days: Dayjs[]): { from: string; to: string } {
  const first = days[0] ?? dayjs();
  const last = days[days.length - 1] ?? first;
  return {
    from: first.startOf("day").toISOString(),
    to: last.endOf("day").toISOString(),
  };
}

/** Instantes de um dia inteiro local — usado ao criar evento/nota "dia todo". */
export function allDayInstants(date: Dayjs): { from: string; to: string } {
  return {
    from: date.startOf("day").toISOString(),
    to: date.endOf("day").toISOString(),
  };
}

/** "YYYY-MM-DD" + "HH:mm" locais → instante ISO. */
export function toInstant(day: string, time?: string): string {
  return dayjs(
    `${day}T${time && time.length > 0 ? time : "00:00"}:00`,
  ).toISOString();
}

/** Instante ISO → "YYYY-MM-DD" local, para preencher `<input type="date">`. */
export function toLocalDay(iso: string): string {
  return dayjs(iso).format("YYYY-MM-DD");
}

/**
 * Próxima meia hora cheia, em "HH:mm" local.
 *
 * Serve de horário padrão ao criar algo tocando num dia: "agora" com minuto
 * quebrado (14:37) é um horário que ninguém quis, e a meia hora seguinte é o
 * que a pessoa ia digitar de qualquer forma.
 */
export function nextHalfHour(): string {
  const now = dayjs();
  const minutes = now.minute();
  const rounded = minutes < 30 ? now.minute(30) : now.add(1, "hour").minute(0);
  return rounded.second(0).format("HH:mm");
}

/** Instante ISO → "HH:mm" local, para `<input type="time">`. */
export function toLocalTime(iso: string): string {
  return dayjs(iso).format("HH:mm");
}

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/**
 * Rótulo do mês em pt-BR sem `dayjs.locale()`.
 *
 * Chamar `dayjs.locale("pt-br")` em escopo de módulo é GLOBAL e mudaria a
 * formatação de outros cinco pontos do app que já usam dayjs — uma mudança
 * silenciosa que ninguém pediu.
 */
export function monthLabel(cursor: Dayjs): string {
  return `${MONTHS[cursor.month()]} de ${cursor.year()}`;
}

export function longDateLabel(date: Dayjs): string {
  return `${WEEKDAYS[date.day()]}, ${date.date()} de ${MONTHS[date.month()]}`;
}
