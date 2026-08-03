import type { Dayjs } from "dayjs";
import type { CommemorativeDate } from "./commemorative-types";
import { FIXED_DATES, buildVariableDates } from "./holidays";
import { buildStateAnniversaries } from "./state-anniversaries";

/**
 * Índice de datas comemorativas dos dias visíveis.
 *
 * Único ponto público do catálogo. Recebe os dias JÁ resolvidos pelo cliente
 * (as 42 células do mês, a semana ou o dia) — nada de dia local calculado no
 * servidor, que roda em UTC.
 */
export function buildCommemorativeIndex(
  days: Dayjs[],
  ufs: string[],
): Map<string, CommemorativeDate[]> {
  const years = new Set(days.map((day) => day.year()));
  const variable = buildVariableDates(years);
  const anniversaries = buildStateAnniversaries(ufs);

  const index = new Map<string, CommemorativeDate[]>();

  for (const day of days) {
    const dayKey = day.format("YYYY-MM-DD");
    const monthDay = day.format("MM-DD");

    const found = [
      ...(FIXED_DATES[monthDay] ?? []),
      ...(anniversaries[monthDay] ?? []),
      ...(variable[dayKey] ?? []),
    ];

    if (found.length > 0) index.set(dayKey, found);
  }

  return index;
}

export type {
  CommemorativeDate,
  CommemorativeKind,
} from "./commemorative-types";
export { KIND_LABEL } from "./commemorative-types";
